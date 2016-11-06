<?php
session_start();
$sqlUser = 'USER';
$sqlDatabase = 'DB_NAME';
$sqlPass = 'PASS';

$conn = mysql_connect($sqlHost, $sqlUser, $sqlPass) or die("Couldn't connect to MySQL server on $sqlHost: " . mysql_error() . '.');

$db = mysql_select_db($sqlDatabase, $conn) or die("Couldn't select database $sqlDatabase: " . mysql_error() . '.');



$SaleDate= date("Y-m-d");
$AgentKey=18;
$Amount=$_REQUEST['Amount'];
$DestinationKey= $_REQUEST['DestinationKey'];
$CustomerKey= $_REQUEST['CustomerKey'];
$SeatCount= $_REQUEST['SeatCount'];
$Email=$_REQUEST['Email'];

$message= "@amessage";

$sql="CALL FINAL_ADDSALE($AgentKey, $Amount, $DestinationKey, '$SaleDate' , $CustomerKey, $SeatCount, @amessage);";
$sql2="SELECT @amessage;";

$Query1 = mysql_query($sql, $conn) or die("Couldn't perform query $sql (".__LINE__."): " . mysql_error() . '.');
$Query2 = mysql_query($sql2, $conn) or die("Couldn't perform query $sql (".__LINE__."): " . mysql_error() . '.');

$retval = mysql_fetch_assoc($Query2);
$convertval = print_r($retval,true);

//brute force to find F in fail lol
if(strcmp($convertval[27], "F") !==0 )
{
     $sql="SELECT SaleID FROM SALE WHERE AgentKey=$AgentKey AND Amount=$Amount AND CustomerKey=$CustomerKey AND SaleDate='$SaleDate' AND SeatCount=$SeatCount LIMIT 1";
     $query = mysql_query($sql, $conn) or die("Couldn't perform query $sql (".__LINE__."): " . mysql_error() . '.');
     $retval = mysql_fetch_assoc($query);
     $SaleID = $retval['SaleID'];

     mail("$Email","Confirm your sale.","Please go to www.terrylp.ics321.com/apis/confirm.php?saleid=$SaleID to confirm your sale.");
     $json = json_encode(["status" => "Please check your email to confirm sale.", "SaleID" => $SaleID]);
}
else
{
     $json = json_encode(["status" => "Not enough seats available. Please pick a smaller amount."]);
}
    echo $json;
?>
