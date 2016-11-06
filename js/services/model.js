/**
 * Data models
 */
Apperyio.Entity = new Apperyio.EntityFactory({
    "Number": {
        "type": "number"
    },
    "Boolean": {
        "type": "boolean"
    },
    "String": {
        "type": "string"
    }
});
Apperyio.getModel = Apperyio.Entity.get.bind(Apperyio.Entity);

/**
 * Data storage
 */
Apperyio.storage = {

    "CustomerID": new $a.LocalStorage("CustomerID", "String"),

    "Email": new $a.LocalStorage("Email", "String"),

    "Name": new $a.LocalStorage("Name", "String"),

    "status": new $a.LocalStorage("status", "String"),

    "Amount": new $a.LocalStorage("Amount", "String"),

    "SeatCount": new $a.LocalStorage("SeatCount", "String"),

    "DestinationKey": new $a.LocalStorage("DestinationKey", "String"),

    "SaleID": new $a.LocalStorage("SaleID", "String")
};