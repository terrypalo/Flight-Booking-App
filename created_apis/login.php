<?php

$sqlUser = 'USER';
$sqlDatabase = 'DB_NAME';
$sqlPass = 'PASS';

$conn = mysql_connect($sqlHost, $sqlUser, $sqlPass) or die("Couldn't connect to MySQL server on $sqlHost: " . mysql_error() . '.');

$db = mysql_select_db($sqlDatabase, $conn) or die("Couldn't select database $sqlDatabase: " . mysql_error() . '.');

$email= $_REQUEST['email'];
$json = json_encode(["status" => "Email doesnt exist, Please enter a valid email."]);

$sql= "SELECT * FROM CUSTOMER WHERE CustomerEmail='$email'";
$query = mysql_query($sql, $conn) or die("Couldn't perform query (".__LINE__."): " . mysql_error() . '.');

while($row = mysql_fetch_assoc($query ))
{
     if($row['CustomerEmail'] == $email)
     {
          $CustomerID = $row['CustomerID'];
          $name = $row['CustomerName'];
          $json = json_encode(["status" => "success", "CustomerID" => $CustomerID, "Email" => $email, "Name" => $name]);
     }
}

echo $json;

?>
