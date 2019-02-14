from __future__ import division
from __future__ import absolute_import
from __future__ import print_function

import numpy as np
import pandas as pd
from axiom.tools.data import panel_fillna, frame_fillna
from axiom.constants import *
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime
import logging
import sys
import pyarrow.parquet as pq
import random

class PQHistoryManager:
    # if offline ,the asset_list could be None
    # NOTE: return of the sqlite results is a list of tuples, each tuple is a row
    def __init__(self, 
        asset_number,
        pq_dataset_path="./data/test/"
        ):
        self.cols = ['close','high','low']
        self.lvls = ['base_asset', 'timestamp_ms']
        self._asset_number = asset_number
        self.__pq_dataset_path = pq_dataset_path;

        self.global_frame = self.get_global_frame();


    def get_global_frame(self):
        # Get full feature frame from bigquery
        dataset = pq.ParquetDataset(self.__pq_dataset_path);
        table = dataset.read()
        frame = table.to_pandas();

        logging.info("Converting timestamp_ms to date time")
        # frame['timestamp_ms'] = np.ceil(x['timestamp_ms']/1000)
        frame['timestamp_ms'] = pd.to_datetime(frame['timestamp_ms'], unit='ms')

        logging.info("Converting columns to numeric")
        frame[self.cols] = frame[self.cols].apply(pd.to_numeric, errors='coerce')

        # TODO create time index and fill na

        logging.info("Selecting features")
        frame = frame[self.lvls+self.cols]
        frame.set_index(self.lvls, inplace=True)

        logging.info("Filling na")
        frame = frame.fillna(axis=1, method="bfill")\
        .fillna(axis=1, method="ffill")\
        .fillna(axis=0, method="ffill")\
        .fillna(axis=0, value=0.0)

        frame = frame.groupby(['base_asset','timestamp_ms']).first()
        return frame

    def sample(self, asset_number, start, end):
        # returns a randomised (by base asset)
        # ordered by time 
        # dataframe for training
        all_assets = list(self.global_frame.index.levels[0])
        if asset_number<=len(all_assets):
            top_assets = random.sample(all_assets, asset_number)
            frame = self.global_frame.loc[top_assets]
            print(frame.shape)
            frame = frame.reset_index()
            mask = (
                frame['timestamp_ms'] > pd.to_datetime(start*1000, unit='ms')
                ) & (
                frame['timestamp_ms'] <= pd.to_datetime(end*1000, unit='ms')
            )
            frame = frame.loc[mask]
            print(frame.shape)
            print(frame.head())
            frame.set_index(self.lvls, inplace=True)
            return frame
        else:
            raise ValueError("Asset number is greater than available")

    def get_global_matrix(self, start, end, features=('close',)):
        frame = self.get_features_frame(start,end,features)
        matrix = frame.to_xarray().to_array()
        return matrix