/*
 * JS for sales generated by Appery.io
 */

Apperyio.getProjectGUID = function() {
    return '4af7b984-e374-46a6-b5a4-74c3c1e49ba9';
};

function navigateTo(outcome, useAjax) {
    Apperyio.navigateTo(outcome, useAjax);
}

function adjustContentHeight() {
    Apperyio.adjustContentHeightWithPadding();
}

function adjustContentHeightWithPadding(_page) {
    Apperyio.adjustContentHeightWithPadding(_page);
}

function setDetailContent(pageUrl) {
    Apperyio.setDetailContent(pageUrl);
}

Apperyio.AppPages = [{
    "name": "welcome",
    "location": "welcome.html"
}, {
    "name": "startScreen",
    "location": "startScreen.html"
}, {
    "name": "signUp",
    "location": "signUp.html"
}, {
    "name": "sales",
    "location": "sales.html"
}, {
    "name": "login",
    "location": "login.html"
}];

function sales_js() {

    /* Object & array with components "name-to-id" mapping */
    var n2id_buf = {
        'mobilegrid_2': 'sales_mobilegrid_2',
        'mobilegridcell_3': 'sales_mobilegridcell_3',
        'mobilelabel_8': 'sales_mobilelabel_8',
        'mobilegridcell_4': 'sales_mobilegridcell_4',
        'mobilelabel_7': 'sales_mobilelabel_7',
        'mobilegridcell_9': 'sales_mobilegridcell_9',
        'mobilelabel_11': 'sales_mobilelabel_11',
        'mobilegridcell_28': 'sales_mobilegridcell_28',
        'mobilelabel_30': 'sales_mobilelabel_30',
        'mobilegrid_12': 'sales_mobilegrid_12',
        'mobilegridcell_13': 'sales_mobilegridcell_13',
        'lblPlace': 'sales_lblPlace',
        'mobilegridcell_19': 'sales_mobilegridcell_19',
        'lblSeatSold': 'sales_lblSeatSold',
        'mobilegridcell_20': 'sales_mobilegridcell_20',
        'lblAmount': 'sales_lblAmount',
        'mobilegridcell_29': 'sales_mobilegridcell_29',
        'lblConfirmed': 'sales_lblConfirmed'
    };

    if ("n2id" in window && window.n2id !== undefined) {
        $.extend(n2id, n2id_buf);
    } else {
        window.n2id = n2id_buf;
    }

    /*
     * Nonvisual components
     */

    Apperyio.mappings = Apperyio.mappings || {};

    Apperyio.mappings["sales_get_sales_onsuccess_mapping_0"] = {
        "homeScreen": "sales",
        "directions": [

        {
            "from_name": "get_sales",
            "from_type": "SERVICE_RESPONSE",

            "to_name": "sales",
            "to_type": "UI",

            "mappings": [

            {

                "source": "$['body']['sales'][i]",
                "target": "$['mobilegrid_12']"

            },

            {

                "source": "$['body']['sales'][i]['DestinationName']",
                "target": "$['mobilegrid_12']['lblPlace:text']"

            },

            {

                "source": "$['body']['sales'][i]['Amount']",
                "target": "$['mobilegrid_12']['lblAmount:text']"

            },

            {

                "source": "$['body']['sales'][i]['SeatCount']",
                "target": "$['mobilegrid_12']['lblSeatSold:text']"

            },

            {

                "source": "$['body']['sales'][i]['Confirmed']",
                "target": "$['mobilegrid_12']['lblConfirmed:text']"

            }

            ]
        }

        ]
    };

    Apperyio.mappings["sales_get_sales_onbeforesend_mapping_0"] = {
        "homeScreen": "sales",
        "directions": []
    };

    Apperyio.datasources = Apperyio.datasources || {};

    window.get_sales = Apperyio.datasources.get_sales = new Apperyio.DataSource(getSalesService, {
        "onBeforeSend": function(jqXHR) {
            Apperyio.processMappingAction(Apperyio.mappings["sales_get_sales_onbeforesend_mapping_0"]);
        },
        "onComplete": function(jqXHR, textStatus) {

        },
        "onSuccess": function(data) {
            Apperyio.processMappingAction(Apperyio.mappings["sales_get_sales_onsuccess_mapping_0"]);
        },
        "onError": function(jqXHR, textStatus, errorThrown) {}
    });

    Apperyio.CurrentScreen = 'sales';
    _.chain(Apperyio.mappings).filter(function(m) {
        return m.homeScreen === Apperyio.CurrentScreen;
    }).each(Apperyio.UIHandler.hideTemplateComponents);

    /*
     * Events and handlers
     */

    // On Load
    var sales_onLoad = function() {
            sales_elementsExtraJS();

            try {
                get_sales.execute({});
            } catch (e) {
                console.error(e);
                hideSpinner();
            };

            sales_deviceEvents();
            sales_windowEvents();
            sales_elementsEvents();
        };

    // screen window events


    function sales_windowEvents() {

        $('#sales').bind('pageshow orientationchange', function() {
            var _page = this;
            adjustContentHeightWithPadding(_page);
        });

    };

    // device events


    function sales_deviceEvents() {
        document.addEventListener("deviceready", function() {

        });
    };

    // screen elements extra js


    function sales_elementsExtraJS() {
        // screen (sales) extra code

    };

    // screen elements handler


    function sales_elementsEvents() {
        $(document).on("click", "a :input,a a,a fieldset label", function(event) {
            event.stopPropagation();
        });

    };

    $(document).off("pagebeforeshow", "#sales").on("pagebeforeshow", "#sales", function(event, ui) {
        Apperyio.CurrentScreen = "sales";
        _.chain(Apperyio.mappings).filter(function(m) {
            return m.homeScreen === Apperyio.CurrentScreen;
        }).each(Apperyio.UIHandler.hideTemplateComponents);
    });

    sales_onLoad();
};

$(document).off("pagecreate", "#sales").on("pagecreate", "#sales", function(event, ui) {
    Apperyio.processSelectMenu($(this));
    sales_js();
});