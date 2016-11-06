/*
 * Services
 */

var LogIn = new Apperyio.RestService({
    'url': 'PATH/TO/login.php',
    'dataType': 'json',
    'type': 'get',

    'defaultRequest': {
        "headers": {},
        "parameters": {},
        "body": null
    }
});

var book_sale_service = new Apperyio.RestService({
    'url': 'PATH/TO/final_api.php',
    'dataType': 'json',
    'type': 'get',

    'defaultRequest': {
        "headers": {},
        "parameters": {},
        "body": null
    }
});

var getSalesService = new Apperyio.RestService({
    'url': 'PATH/TO/sales_api.php',
    'dataType': 'json',
    'type': 'get',

    'defaultRequest': {
        "headers": {},
        "parameters": {},
        "body": null
    }
});

var SignUp = new Apperyio.RestService({
    'url': 'PATH/TO/signup.php',
    'dataType': 'json',
    'type': 'get',

    'defaultRequest': {
        "headers": {},
        "parameters": {},
        "body": null
    }
});

var amount_service = new Apperyio.RestService({
    'url': 'PATH/TO/amount.php',
    'dataType': 'json',
    'type': 'get',

    'defaultRequest': {
        "headers": {},
        "parameters": {},
        "body": null
    }
});
