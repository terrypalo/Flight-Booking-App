<?php

$sqlUser = 'USER';
$sqlDatabase = 'DB_NAME';
$sqlPass = 'PASS';

$conn = mysql_connect($sqlHost, $sqlUser, $sqlPass) or die("Couldn't connect to MySQL server on $sqlHost: " . mysql_error() . '.');

$db = mysql_select_db($sqlDatabase, $conn) or die("Couldn't select database $sqlDatabase: " . mysql_error() . '.');

$sql="SELECT * FROM SALE S INNER JOIN DESTINATION D ON S.Destinationkey=D.DestinationID WHERE AgentKey=18 ORDER BY D.DestinationName ";
$saletable = mysql_query($sql, $conn) or die("Couldn't perform query (".__LINE__."): " . mysql_error() . '.');
$sales = [];
while ($arr = mysql_fetch_assoc($saletable)) array_push($sales,$arr);

$json = json_encode(["sales" => $sales ]);
echo $json;

?>
