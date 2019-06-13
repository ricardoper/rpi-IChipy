/**
 *
 * -- IChipy --
 *
 * 74HC165 Parallel-in / Serial-out Shift Register for Node-Red
 *
 * https://github.com/ricardoper/rpi-IChipy
 *
 *
 * MIT License
 *
 * Copyright (c) 2019 Ricardo Pereira
 *
 */
module.exports = function (RED) {
    "use strict";

    var spawn = require('child_process').spawn,
        crypto = require('crypto');

    process.env.PYTHONUNBUFFERED = 1;

    function Node74HC165(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        node.icName = '74HC165';
        node.childCmd = getChildCmd(node);
        node.dataHistory = null;

        var ctx = this.context().global;


        nodeWaiting(node);

        generateStoreId(node, config);

        pollingDataSingleton(node, config, ctx);

        var updTimer = updateNodeTimer(node, config, ctx);

        globalEvents(node, config, ctx, updTimer);


        function nodeWaiting(node) {
            node.status({
                fill: "grey",
                shape: "dot",
                text: "Waiting..."
            });
        }

        function nodeOn(node) {
            node.status({
                fill: "green",
                shape: "dot",
                text: "ON"
            });
        }

        function nodeOff(node) {
            node.status({
                fill: "red",
                shape: "dot",
                text: "OFF"
            });
        }

        function nodeClosing(node) {
            node.status({
                fill: "grey",
                shape: "dot",
                text: "Closing..."
            });
        }


        function getNodeId(config, ctx) {
            return ctx.get('nodeId-' + config.storeId);
        }

        function setNodeId(config, ctx, value) {
            return ctx.set('nodeId-' + config.storeId, value);
        }

        function getData(config, ctx) {
            return ctx.get('data-' + config.storeId);
        }

        function setData(config, ctx, value) {
            return ctx.set('data-' + config.storeId, value);
        }

        function getChildCmd(node) {
            return __dirname + '/../../rpi/' + node.icName + '.py';
        }


        function generateStoreId(node, config) {
            var storeId = 'serialOut:' + config.serialOut + '|';
            storeId += 'loadData:' + config.loadData + '|';
            storeId += 'clock:' + config.clock + '|';
            storeId += 'bits:' + config.bits;

            storeId = crypto.createHash('sha1').update(storeId).digest('hex');

            config.storeId = node.icName + '-' + storeId;

            node.debug('StoreID: ' + config.storeId);
        }


        function pollingDataSingleton(node, config, ctx) {
            if (getData(config, ctx) === undefined) {
                setData(config, ctx, null);
                setNodeId(config, ctx, node.id);

                pollingData(node, config, ctx);

                node.debug('Polling Data started');
            }
        }

        function pollingData(node, config) {
            // Launch the polling data process //
            node.child = spawn(node.childCmd, ["loop", "--serialOut", config.serialOut, "--loadData", config.loadData, "--clock", config.clock, "--bits", config.bits]);

            childEvents(node, ctx);
        }


        function updateNodeTimer(node, config, ctx) {
            return setInterval(function () {
                updateNode(node, config, ctx);
            }, 500);
        }

        function updateNode(node, config, ctx) {
            if (getData(config, ctx) >= 0) {
                // Check input bit //
                var bit = 1 << config.bit & getData(config, ctx);

                var status = false;

                if (bit > 0) {
                    nodeOn(node);

                    status = true;
                } else {
                    nodeOff(node);
                }

                // Only sends when data is changed //
                if (node.dataHistory === null || node.dataHistory !== bit) {
                    node.dataHistory = bit;

                    node.send({
                        id: node.id,
                        bit: config.bit,
                        payload: status,
                        storeId: config.storeId
                    });
                }
            }
        }


        function globalEvents(node, config, ctx, updTimer) {
            evNodeOnClose(node, config, ctx, updTimer);

            node.debug('Global Events Loaded');
        }

        function childEvents(node, ctx) {
            evChildOnStdout(node, ctx);

            evChildOnStderr(node);

            evChildOnClose(node);

            evChildOnExit(node, ctx);

            node.debug('Child Events Loaded');
        }

        function evChildOnStdout(node, ctx) {
            // Store data when it arrives //
            node.child.stdout.on('data', function (stdout) {
                setData(config, ctx, stdout.toString().trim());
            });
        }

        function evChildOnStderr(node) {
            node.child.stderr.on('data', function (stderr) {
                node.error('Child.onError: ' + stderr);
            });
        }

        function evChildOnClose(node) {
            node.child.on('close', function (code, signal) {
                node.debug('Child.onClose: ' + code + ' - ' + signal);
            });
        }

        function evChildOnExit(node, ctx) {
            node.child.on('exit', function (code, signal) {
                node.debug('Child.onExit: ' + code + ' - ' + signal);

                // Restart dead polling data process //
                if (signal === null) {
                    setData(config, ctx, undefined);

                    pollingDataSingleton(node, config, ctx);
                }
            });
        }

        function evNodeOnClose(node, config, ctx, updTimer) {
            node.on("close", function (done) {
                node.debug('NodeRed.onClose');

                nodeClosing(node);

                clearTimeout(updTimer);

                // Only Kills the process where it has been created //
                if (node.id === getNodeId(config, ctx)) {
                    setData(config, ctx, undefined);

                    node.debug('Child.SIGKILL');
                    node.child.kill('SIGKILL');
                }

                done();
            });
        }
    }

    RED.nodes.registerType('74HC165', Node74HC165);
};
