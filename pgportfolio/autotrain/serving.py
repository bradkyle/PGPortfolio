from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import logging
import os
import time
from multiprocessing import Process
from pgportfolio.learn.tradertrainer import TraderTrainer
from pgportfolio.tools.configprocess import load_config
from flask import Flask, request, jsonify
import six


########## Error handling ##########
class InvalidUsage(Exception):
    status_code = 400
    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['message'] = self.message
        return rv

def get_required_param(json, param):
    if json is None:
        logger.info("Request is not a valid json")
        raise InvalidUsage("Request is not a valid json")
    value = json.get(param, None)
    if (value is None) or (value=='') or (value==[]):
        logger.info("A required request parameter '{}' had value {}".format(param, value))
        raise InvalidUsage("A required request parameter '{}' was not provided".format(param))
    return value

def get_optional_param(json, param, default):
    if json is None:
        logger.info("Request is not a valid json")
        raise InvalidUsage("Request is not a valid json")
    value = json.get(param, None)
    if (value is None) or (value=='') or (value==[]):
        logger.info("An optional request parameter '{}' had value {} and was replaced with default value {}".format(param, value, default))
        value = default
    return value

@app.errorhandler(InvalidUsage)
def handle_invalid_usage(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response

class Server():
   def __init__(
                self, 
                config, 
                fake_data=False, 
                restore_dir=None, 
                save_path=None, 
                device="cpu",
                 agent=None
                 ):
        self.config = config
        self.train_config = config["training"]

    def serve(self):   
        ########## App setup ##########
        app = Flask(__name__)
        app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False

        @app.route('/v1/agent/act/', methods=['POST'])
        def agent_step(instance_id):
            """
            Run one timestep of the environment's dynamics.
            Parameters:
                - instance_id: a short identifier (such as '3c657dbc')
                for the environment instance
                - action: an action to take in the environment
            Returns:
                - observation: agent's observation of the current
                environment
                - reward: amount of reward returned after previous action
                - done: whether the episode has ended
                - info: a dict containing auxiliary diagnostic information
            """
            json = request.get_json()
            observation = get_required_param(json, 'input')
            previous_w = get_required_param(json, 'previous_w')

            action = self.agent.act(input_num=input_num,input=observation,previous_w=previous_w)

            return jsonify(action=action)


def train_one(save_path, config, log_file_dir, index, logfile_level, console_level, device):
    """
    train an agent
    :param save_path: the path to save the tensorflow model (.ckpt), could be None
    :param config: the json configuration file
    :param log_file_dir: the directory to save the tensorboard logging file, could be None
    :param index: identifier of this train, which is also the sub directory in the train_package,
    if it is 0. nothing would be saved into the summary file.
    :param logfile_level: logging level of the file
    :param console_level: logging level of the console
    :param device: 0 or 1 to show which gpu to use, if 0, means use cpu instead of gpu
    :return : the Result namedtuple
    """
    if log_file_dir:
        logging.basicConfig(filename=log_file_dir.replace("tensorboard","programlog"),
                            level=logfile_level)
        console = logging.StreamHandler()
        console.setLevel(console_level)
        logging.getLogger().addHandler(console)
    print("training at %s started" % index)
    return TraderTrainer(
        config,
        save_path=save_path+"/netfile",
        device=device
    ).train_net(
        log_file_dir=log_file_dir,
        model_path = save_path+"/serving/"+config["input"]["market"]+"_"+str(config["input"]["window_size"]),
        index=index
    )

def train_all(processes=1, device="cpu"):
    """
    train all the agents in the train_package folders

    :param processes: the number of the processes. If equal to 1, the logging level is debug
                      at file and info at console. If greater than 1, the logging level is
                      info at file and warming at console.
    """
    if processes == 1:
        console_level = logging.INFO
        logfile_level = logging.DEBUG
    else:
        console_level = logging.WARNING
        logfile_level = logging.INFO
    train_dir = "train_package"
    if not os.path.exists("./" + train_dir): #if the directory does not exist, creates one
        os.makedirs("./" + train_dir)
    all_subdir = os.listdir("./" + train_dir)
    all_subdir.sort()
    pool = []
    for dir in all_subdir:
        # train only if the log dir does not exist
        if not str.isdigit(dir):
            return
        # NOTE: logfile is for compatibility reason
        if not (os.path.isdir("./"+train_dir+"/"+dir+"/tensorboard") or os.path.isdir("./"+train_dir+"/"+dir+"/logfile")):
            p = Process(
                target=train_one,
                args=(
                    "./" + train_dir + "/" + dir,
                    load_config(dir),
                    "./" + train_dir + "/" + dir + "/tensorboard",
                    dir, logfile_level, console_level, device
                )
            )
            p.start()
            pool.append(p)
        else:
            print("Already trained nnagents in "+train_dir+": generate new or reinitialize agents to start again")
            continue

        # suspend if the processes are too many
        wait = True
        while wait:
            time.sleep(5)
            for p in pool:
                alive = p.is_alive()
                if not alive:
                    pool.remove(p)
            if len(pool)<processes:
                wait = False
    print("All the Tasks are Over")

