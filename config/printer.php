<?php

return [
    'default' => env('PRINTER_DEFAULT', 'main'),

    'printers' => [

        'main' => [
            'enabled' => env('PRINTER_MAIN_ENABLED', true),
            'method' => env('PRINTER_MAIN_METHOD', 'network'),
            'com_port' => env('PRINTER_MAIN_COM_PORT', 'COM3'),
            'com_baud' => env('PRINTER_MAIN_BAUD', 9600),
            'network_ip' => env('PRINTER_MAIN_IP', '192.168.1.100'),
            'network_port' => env('PRINTER_MAIN_PORT', 9100),
        ],

        // If each branch needs its own physical printer, add one profile
        // per branch and map branch_id -> printer name in
        // 'branch_printers' below. Example:
        // 'branch_2' => [
        //     'enabled' => env('PRINTER_BRANCH2_ENABLED', true),
        //     'method' => env('PRINTER_BRANCH2_METHOD', 'network'),
        //     'com_port' => env('PRINTER_BRANCH2_COM_PORT', 'COM4'),
        //     'com_baud' => env('PRINTER_BRANCH2_BAUD', 9600),
        //     'network_ip' => env('PRINTER_BRANCH2_IP', '192.168.1.101'),
        //     'network_port' => env('PRINTER_BRANCH2_PORT', 9100),
        // ],
    ],

    // Maps branch_id => printer name, so each branch's terminal auto-prints
    // to its own physical printer. Leave empty to always use 'default'.
    // Example: [1 => 'main', 2 => 'branch_2'],
    'branch_printers' => [],

    'connect_timeout' => env('PRINTER_TIMEOUT', 2),
    'store_name' => env('PRINTER_STORE_NAME', 'WESTPOINT PHARMACY'),
];