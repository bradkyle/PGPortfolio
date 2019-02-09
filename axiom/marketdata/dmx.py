from __future__ import division
from __future__ import absolute_import
from __future__ import print_function

from axiom.marketdata.coinlist import CoinList
import numpy as np
import pandas as pd
from axiom.tools.data import panel_fillna, frame_fillna
from axiom.constants import *
import sqlite3
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime
import logging
import sys


class HistoryManager:
    # if offline ,the coin_list could be None
    # NOTE: return of the sqlite results is a list of tuples, each tuple is a row
    def __init__(self, coin_number, end, volume_average_days=1, volume_forward=0, online=True, db_file="Data.db", table="History"):
        self._db_path = "./database/"+db_file
        self.initialize_db(table)
        self.__storage_period = FIVE_MINUTES  # keep this as 300
        self._coin_number = coin_number
        self._online = online
        if self._online:
            self._coin_list = CoinList(end, volume_average_days, volume_forward)
        self.__volume_forward = volume_forward
        self.__volume_average_days = volume_average_days
        self.__coins = None
        self.__table = table

    @property
    def coins(self):
        return self.__coins

    def initialize_db(self,table):
        with sqlite3.connect(self._db_path) as connection:
            cursor = connection.cursor()
            sql = 'CREATE TABLE IF NOT EXISTS {table} (date INTEGER, coin varchar(20), high FLOAT, low FLOAT,  open FLOAT, close FLOAT, volume FLOAT, quoteVolume FLOAT, weightedAverage FLOAT, PRIMARY KEY (date, coin));'.format(table=table)            
            cursor.execute(sql)
            connection.commit()

    def get_global_data_matrix(self, start, end, period=300, features=('close',)):
        """
        :return a numpy ndarray whose axis is [feature, coin, time]
        """
        return self.get_global_panel(start, end, period, features).values

    def get_global_panel(self, start, end, period=300, features=('close',)):
        """
        :param start/end: linux timestamp in seconds
        :param period: time interval of each data access point
        :param features: tuple or list of the feature names
        :return a panel, [feature, coin, time]
        """
        start = int(start - (start%period))
        end = int(end - (end%period))

        # Determine coins by volume
        coins = self.select_coins(
             start=end - self.__volume_forward - self.__volume_average_days * DAY,
             end=end-self.__volume_forward
        )

        print(period)

        self.__coins = coins
        #for coin in coins:
          #  self.update_data(start, end, coin)

        if len(coins)!=self._coin_number:
            raise ValueError("the length of selected coins %d is not equal to expected %d"
                             % (len(coins), self._coin_number))

        logging.info("feature type list is %s" % str(features))
        self.__checkperiod(period)

        time_index = pd.to_datetime(list(range(start, end+1, period)),unit='s')
        panel = pd.Panel(items=features, major_axis=coins, minor_axis=time_index, dtype=np.float32)

        connection = sqlite3.connect(self._db_path)
        try:
            for _, coin in enumerate(coins):
                for feature in features:
                    # NOTE: transform the start date to end date
                    if feature == "close":
                        sql = ("SELECT date+300 AS date_norm, close FROM {table} WHERE"
                               " date_norm>={start} and date_norm<={end}"
                               " and date_norm%{period}=0 and coin=\"{coin}\"".format(
                                   table=self.__table, start=start, end=end, period=period, coin=coin))
                    elif feature == "open":
                        sql = ("SELECT date+{period} AS date_norm, open FROM {table} WHERE"
                               " date_norm>={start} and date_norm<={end}"
                               " and date_norm%{period}=0 and coin=\"{coin}\"".format(
                                   table=self.__table,start=start, end=end, period=period, coin=coin))
                    elif feature == "volume":
                        sql = ("SELECT date_norm, SUM(volume)"+
                               " FROM (SELECT date+{period}-(date%{period}) "
                               "AS date_norm, volume, coin FROM {table})"
                               " WHERE date_norm>={start} and date_norm<={end} and coin=\"{coin}\""
                               " GROUP BY date_norm".format(
                                   table=self.__table,period=period,start=start,end=end,coin=coin))
                    elif feature == "high":
                        sql = ("SELECT date_norm, MAX(high)" +
                               " FROM (SELECT date+{period}-(date%{period})"
                               " AS date_norm, high, coin FROM {table})"
                               " WHERE date_norm>={start} and date_norm<={end} and coin=\"{coin}\""
                               " GROUP BY date_norm".format(
                                   table=self.__table,period=period,start=start,end=end,coin=coin))
                    elif feature == "low":
                        sql = ("SELECT date_norm, MIN(low)" +
                                " FROM (SELECT date+{period}-(date%{period})"
                                " AS date_norm, low, coin FROM {table})"
                                " WHERE date_norm>={start} and date_norm<={end} and coin=\"{coin}\""
                                " GROUP BY date_norm".format(
                                    table=self.__table,period=period,start=start,end=end,coin=coin))
                    else:
                        msg = ("The feature %s is not supported" % feature)
                        logging.error(msg)
                        raise ValueError(msg)
                    print(coin)
                    print(feature)
                    serial_data = pd.read_sql_query(sql, con=connection,
                                                    parse_dates=["date_norm"],
                                                    index_col="date_norm")
                    # print(serial_data)
                    print(serial_data.index)
                    print(serial_data.shape)
                    print(serial_data.squeeze().shape)
                    print(panel.shape)

                    # TODO change to dataframe
                    panel.loc[feature, coin, serial_data.index] = serial_data.squeeze()
                    panel = panel_fillna(panel, "both")

        finally:
            connection.commit()
            connection.close()
        print(panel)
        print(panel.values)
        return panel

    # select top coin_number of coins by volume from start to end
    def select_coins(self, start, end):
        if not self._online:
            logging.info("select coins offline from %s to %s" % (datetime.fromtimestamp(start).strftime('%Y-%m-%d %H:%M'),
                                                                    datetime.fromtimestamp(end).strftime('%Y-%m-%d %H:%M')))
            connection = sqlite3.connect(self._db_path)
            try:
                cursor=connection.cursor()
                sql = 'SELECT coin, SUM(volume) AS total_volume FROM {table} WHERE date>=? and date<=? GROUP BY coin ORDER BY total_volume DESC LIMIT ?;'.format(table=self.__table);
                cursor.execute(sql, (int(start), int(end), self._coin_number))
                coins_tuples = cursor.fetchall()

                if len(coins_tuples)!=self._coin_number:
                    logging.error("the sqlite error happend")
            finally:
                connection.commit()
                connection.close()
            coins = []
            for tuple in coins_tuples:
                coins.append(tuple[0])
        else:
            coins = list(self._coin_list.topNVolume(n=self._coin_number).index)
        logging.debug("Selected coins are: "+str(coins))
        return coins

    def __checkperiod(self, period):
        # if period == ONE_MINUTE:
        #     return
        if period == FIVE_MINUTES:
            return
        elif period == FIFTEEN_MINUTES:
            return
        elif period == HALF_HOUR:
            return
        elif period == TWO_HOUR:
            return
        elif period == FOUR_HOUR:
            return
        elif period == DAY:
            return
        else:
            raise ValueError('peroid has to be 1min, 5min, 15min, 30min, 2hr, 4hr, or a day')

    # add new history data into the database
    def update_data(self, start, end, coin):
        connection = sqlite3.connect(self._db_path)
        try:
            cursor = connection.cursor()
            min_date = cursor.execute('SELECT MIN(date) FROM {table} WHERE coin=?;'.format(table=self.__table), (coin,)).fetchall()[0][0]
            max_date = cursor.execute('SELECT MAX(date) FROM {table} WHERE coin=?;'.format(table=self.__table), (coin,)).fetchall()[0][0]

            if min_date==None or max_date==None:
                self.__fill_data(start, end, coin, cursor)
            else:
                if max_date+10*self.__storage_period<end:
                    if not self._online:
                        raise Exception("Have to be online")
                    self.__fill_data(max_date + self.__storage_period, end, coin, cursor)
                if min_date>start and self._online:
                    self.__fill_data(start, min_date - self.__storage_period-1, coin, cursor)

            # if there is no data
        finally:
            connection.commit()
            connection.close()

    def __fill_data(self, start, end, coin, cursor):
        chart = self._coin_list.get_chart_until_success(
            pair=self._coin_list.allActiveCoins.at[coin, 'pair'],
            start=start,
            end=end,
            period=self.__storage_period)
        logging.info("fill %s data from %s to %s"%(coin, datetime.fromtimestamp(start).strftime('%Y-%m-%d %H:%M'),
                                            datetime.fromtimestamp(end).strftime('%Y-%m-%d %H:%M')))
        for c in chart:
            if c["date"] > 0:
                if c['weightedAverage'] == 0:
                    weightedAverage = c['close']
                else:
                    weightedAverage = c['weightedAverage']

                #NOTE here the USDT is in reversed order
                if 'reversed_' in coin:
                    cursor.execute('INSERT INTO {table} VALUES (?,?,?,?,?,?,?,?,?)'.format(table=self.__table),
                        (c['date'],coin,1.0/c['low'],1.0/c['high'],1.0/c['open'],
                        1.0/c['close'],c['quoteVolume'],c['volume'],
                        1.0/weightedAverage))
                else:
                    cursor.execute('INSERT INTO {table} VALUES (?,?,?,?,?,?,?,?,?)'.format(table=self.__table),
                                   (c['date'],coin,c['high'],c['low'],c['open'],
                                    c['close'],c['volume'],c['quoteVolume'],
                                    weightedAverage))
