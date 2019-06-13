#!/usr/bin/env python3
# -*- coding: utf-8 -*-


'''

-- IChipy --

74HC165 Parallel-in / Serial-out Shift Register for Raspberry Pi

https://github.com/ricardoper/rpi-IChipy


MIT License

Copyright (c) 2019 Ricardo Pereira

'''


import sys
import argparse
import platform
import RPi.GPIO as io

from time import sleep


class IC74HC165():
    def __init__(self, pinSerialOut=11, pinLoadData=13, pinClock=15, pinBits=8):
        io.setwarnings(False)
        io.setmode(io.BOARD)

        self.pinSerialOut = pinSerialOut
        self.pinLoadData = pinLoadData
        self.pinClock = pinClock
        self.pinBits = pinBits

        self.sleep = 0.00001 # 10us

        self._initGpios()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        io.cleanup()

    def _initGpios(self):
        ## Config GPIO's ##
        io.setup(self.pinSerialOut, io.IN, pull_up_down=io.PUD_DOWN)
        io.setup(self.pinLoadData, io.OUT)
        io.setup(self.pinClock, io.OUT)

        ## Set GPIO's default values ##
        io.output(self.pinLoadData, 1)
        io.output(self.pinClock, 0)

    def _loadData(self):
        io.output(self.pinLoadData, 0)
        sleep(self.sleep)
        io.output(self.pinLoadData, 1)
        sleep(self.sleep)

    def _cycleClock(self):
        io.output(self.pinClock, 1)
        sleep(self.sleep)
        io.output(self.pinClock, 0)
        sleep(self.sleep)

    def _readInputs(self):
        inputs = 0

        self._loadData()

        for input in range(self.pinBits):
            inputs |= io.input(self.pinSerialOut) << input

            self._cycleClock()

        return inputs

    def readInputs(self):
        return self._readInputs()

    def readInput(self, bit):
        return bool(1 << bit & self._readInputs())


## CLI APP ##
def errPrint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


parser = argparse.ArgumentParser(description='74HC165 Parallel-in / Serial-out Shift Register for Raspberry Pi')

parser.add_argument('command', type=str, choices=['all', 'loop', 'input', 'info'], help='Command/Action to run')
parser.add_argument('bit', type=int, nargs='?', default=-1, help='Input bit to read (0 ... [--bits - 1] | required for \'input\' command)')

parser.add_argument('--serialOut', type=int, default=11, help='SerialOut pin (default: 11 - GPIO 0)')
parser.add_argument('--loadData', type=int, default=13, help='LoadData pin (default: 13 - GPIO 2)')
parser.add_argument('--clock', type=int, default=15, help='Clock pin (default: 15 - GPIO 3)')
parser.add_argument('--bits', type=int, default=8, help='Total bits to read from (default: 8bits for single 74HC165)')

args = parser.parse_args()

if args.command == 'input' and args.bit == -1:
    errPrint('Bad parameters: \'bit\' is required for this command')
    sys.exit(1)
elif args.command == 'input' and (args.bit < 1 or args.bit > args.bits):
    errPrint('Bad parameters: \'bit\' must be 1 ... ' + str(args.bits))
    sys.exit(1)


bits = args.bits

if args.command == 'input':
    bits = args.bit

with IC74HC165(args.serialOut, args.loadData, args.clock, bits) as ic74hc165:
    if args.command == 'all':
        print(ic74hc165.readInputs())

    if args.command == 'loop':
        try:
            while True:
                print(ic74hc165.readInputs())
                sleep(1)
        except KeyboardInterrupt:
            sys.exit(0)

    elif args.command == 'input':
        print(ic74hc165.readInput(args.bit))

    elif args.command == 'info':
        print('\n\t Python: ' + platform.python_version() + ' - ' + platform.python_compiler())
        print('\n\t 74HC165:')
        print('\t\t - Bits: ' + str(bits))
        print('\n\t RPi pins:')
        print('\t\t - SerialOut: ' + str(args.serialOut))
        print('\t\t - LoadData: ' + str(args.loadData))
        print('\t\t - Clock: ' + str(args.clock) + '\n')

    sys.exit(0)
