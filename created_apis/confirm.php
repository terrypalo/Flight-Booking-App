<?php

$sqlUser = 'USER';
$sqlDatabase = 'DB_NAME';
$sqlPass = 'PASS';

$conn = mysql_connect($sqlHost, $sqlUser, $sqlPass) or die("Couldn't connect to MySQL server on $sqlHost: " . mysql_error() . '.');

$db = mysql_select_db($sqlDatabase, $conn) or die("Couldn't select database $sqlDatabase: " . mysql_error() . '.');

$saleid = $_REQUEST['saleid'];
$confirm = date("Y-m-d");


$sql="UPDATE SALE SET Confirmed='$confirm' WHERE SaleID=$saleid";
$query = mysql_query($sql, $conn) or die("Couldn't perform query $sql (".__LINE__."): " . mysql_error() . '.');

echo "You have successfully confirmed your booking."

?>
