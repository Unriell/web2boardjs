module.exports = function () {
    const LOG = require('electron-log'),
        SERIAL_PORT = require('serialport'),
        READ_LINE = SERIAL_PORT.parsers.Readline,
        DEFAULT_DELIMITER = '\r\n';

    var port,
        parser,
        trysOnCloseOpeningPort;

    function openSerialPort(params, socket, callback) {
        if (params && params.port && params.baudRate) {
            if (!port || params.forceReconnect || isDifferentPort(port, params)) {
                if (params.forceReconnect || isDifferentPort(port, params)) {
                    closeSerialPort(function () {
                        createSerialPortObject(params, socket, callback);
                    });
                } else {
                    createSerialPortObject(params, socket, callback);
                }
            } else {
                callback(null, 'port-was-opened-before')
            }
        } else if (!params) {
            callback('no-params');
        } else if (!params.port) {
            callback('no-port');
        } else {
            callback('no-baudrate');
        }
    }

    function isDifferentPort(port, params) {
        let result = true;
        if (port &&
            port.path === params.port &&
            port.baudRate === params.baudRate) {
            result = false;
        }
        return result;
    }

    function createSerialPortObject(params, socket, callback) {
        port = new SERIAL_PORT(params.port, { baudRate: params.baudRate }, function (err) {
            if (err) {
                LOG.info('error openening port', err);
                closeSerialPort();
                callback(err.message);
            } else {
                if (port) {
                    callback(null, 'port-opened')
                    parser = port.pipe(new READ_LINE({ delimiter: params.delimiter || DEFAULT_DELIMITER }));
                    parser.on('data', function (data) {
                        LOG.info('data', data);
                        socket.emit('serialportdata', data);
                    });
                } else {
                    callback('port-was-closed');
                }
            }
        });
        port.on('error', function (err) {
            LOG.info('error', err);
            closeSerialPort();
        });
        port.on('close', function (err) {
            LOG.info('close', err);
            socket.emit('serialportclosed');
            closeSerialPort();
        });
    }

    function closeSerialPort(callback) {
        if (port) {
            if (port.isOpen) {
                port.close(function (err) {
                    LOG.info('Port closed', err);
                    port = null;
                    trysOnCloseOpeningPort = 0;
                    if (callback) {
                        callback(err);
                    }
                });
            } else if (port.isOpening) {
                if (trysOnCloseOpeningPort < 3) {
                    trysOnCloseOpeningPort++;
                    setTimeout(function () {
                        closeSerialPort(callback);
                    }, 2000);
                } else {
                    LOG.info('cant close serial port');
                }

            } else {
                port = null;
                trysOnCloseOpeningPort = 0;
                if (callback) {
                    callback();
                }
            }
        } else {
            trysOnCloseOpeningPort = 0;
            if (callback) {
                callback();
            }
        }
    }

    function sendToSerialPort(params, callback) {
        if (port) {
            port.write(params.data, callback);
        } else {
            callback('port-not-opened');
        }
    }

    function getPorts(callback) {
        SERIAL_PORT.list(function (err, ports) {
            callback(err, ports);
        });
    }

    return {
        openSerialPort: openSerialPort,
        closeSerialPort: closeSerialPort,
        sendToSerialPort: sendToSerialPort,
        getPorts: getPorts
    };
};