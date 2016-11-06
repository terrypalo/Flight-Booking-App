<?php

$sqlUser = 'USER';
$sqlDatabase = 'DB_NAME';
$sqlPass = 'PASS';

$conn = mysql_connect($sqlHost, $sqlUser, $sqlPass) or die("Couldn't connect to MySQL server on $sqlHost: " . mysql_error() . '.');

$db = mysql_select_db($sqlDatabase, $conn) or die("Couldn't select database $sqlDatabase: " . mysql_error() . '.');

$email= $_REQUEST['email'];
$name= $_REQUEST['name'];

$sql= "SELECT * FROM CUSTOMER WHERE CustomerEmail='$email'";
$query = mysql_query($sql, $conn) or die("Couldn't perform query (".__LINE__."): " . mysql_error() . '.');

if($findemail = mysql_fetch_assoc($query ))
{
    $CustomerID = $findemail['CustomerID'];
    $json = json_encode(["status" => "Email already registered. Please Enter a different Email."]);
}
else
{
    $sql= "INSERT INTO CUSTOMER SET CustomerEmail= '$email', CustomerName='$name'";
    $query = mysql_query($sql, $conn) or die("Couldn't perform query (".__LINE__."): " . mysql_error() . '.');

    $sql= "SELECT * FROM CUSTOMER WHERE CustomerEmail= '$email'";
    $query = mysql_query($sql, $conn) or die("Couldn't perform query (".__LINE__."): " . mysql_error() . '.');

    if($findemail = mysql_fetch_assoc($query ))
    {
        $CustomerID = $findemail['CustomerID'];
        $json = json_encode(["status" => "success", "CustomerID" => $CustomerID, "Email" => $email, "Name" => $name]);
    }

}

echo $json

?>
