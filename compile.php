<?php

$file = file_get_contents(__DIR__ . '/app.php');
$file = str_replace(
    [
        '<!-- STYLE REPLACEMENT -->',
        '<!-- JS REPLACEMENT -->'
    ],
    [
        file_get_contents(__DIR__  . '/app.css'),
        file_get_contents(__DIR__ . '/app.js')
    ],
    $file
);

file_put_contents(__DIR__ . '/install.php', $file);