from __future__ import division
from __future__ import absolute_import
from __future__ import print_function

import numpy as np
import pandas as pd
from axiom.tools.data import panel_fillna, frame_fillna
from axiom.constants import *
from google.cloud import bigquery
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime
import logging
import sys


class BQHistoryManager:
    # if offline ,the asset_list could be None
    # NOTE: return of the sqlite results is a list of tuples, each tuple is a row
    def __init__(self, 
        asset_number,
        bq_table="Binance_1m_BTC_klines.Binance_1m_BTC_1500005000_1548440000"
        ):
        self._asset_number = asset_number
        self.__bq_table = bq_table
        self.__client = bigquery.Client()

    def get_feature_frame(
        self,
        bq_table,
        start,
        end,
        selection_start,
        selection_end, 
        asset_num
        ):
        print("Querying data from BigQuery")
        query = """
        SELECT
        base_asset,
        timestamp_ms,
        CAST(close AS FLOAT64) AS c,
        CAST(open AS FLOAT64) AS o,
        CAST(low AS FLOAT64) AS l,
        CAST(high AS FLOAT64) AS h,
        CAST(quote_asset_volume AS FLOAT64) AS v,
        CAST(trades AS FLOAT64) AS t
        FROM {bqt}
        WHERE base_asset IN (
            SELECT base_asset
            FROM {bqt}
            WHERE close_timestamp_ms>={sts} AND close_timestamp_ms<={ets}
            GROUP BY base_asset ORDER BY SUM(CAST(quote_asset_volume AS FLOAT64)) DESC LIMIT {an}
        )
        AND timestamp_ms>={st}
        AND timestamp_ms<={et}+1
        ORDER BY base_asset,timestamp_ms;
        """.format(
            st=start*1000,#convert to ms
            et=end*1000,
            sts=selection_start*1000,
            ets=selection_end*1000,
            bqt=self.__bq_table,
            an=self._asset_number
        )
        print({
            'start': start,
            'end': end,
            'table': bq_table,
            'ets': selection_end,
            'sts': selection_start,
            'an': asset_num
        })
        query_job = self.__client.query(query)
        frame = query_job.to_dataframe()
        print("Data Queried Successfully")
        return frame

    def get_global_frame(
         self,
         start, 
         end, 
         features=['c','h', 'l']
        ):
        print(self.__bq_table)

        # Get full feature frame from bigquery
        frame = self.get_feature_frame(
            bq_table=self.__bq_table,
            start=start,
            end=end,
            selection_start=(end-(60*1440)), # 1 DAY
            selection_end=end,
            asset_num=self._asset_number
        )

        # Create a time index indicative of the period
        t_index = list(range(int(start), int(end), 60))
        time_index = pd.to_datetime(t_index,unit='s')
        time_index = time_index.round('min')

        # Format frame into MultiIndex and clean values
        frame['timestamp_ms'] = pd.to_datetime(frame['timestamp_ms'], unit='ms')
        frame.set_index(['base_asset', 'timestamp_ms'], inplace=True)
        frame=frame.groupby(['base_asset','timestamp_ms']).first()
        ind = pd.MultiIndex.from_product([frame.index.levels[0], time_index], names=frame.index.names)
        frame = frame.reindex(ind)

        # TODO check
        frame = frame.fillna(axis=0, method="bfill").fillna(axis=0, method="ffill")

        # Filter frame by desired columns
        final_frame = frame[features]
        return final_frame

    def get_global_matrix(self, start, end, features=('close',)):
        frame = self.get_features_frame(start,end,features)
        matrix = frame.to_xarray().to_array()
        return matrix