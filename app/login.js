/*
 * JS for login generated by Appery.io
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

function login_js() {

    /* Object & array with components "name-to-id" mapping */
    var n2id_buf = {
        'spacer_4': 'login_spacer_4',
        'lblLoginEmail': 'login_lblLoginEmail',
        'spacer_5': 'login_spacer_5',
        'btnLoginSubmit': 'login_btnLoginSubmit',
        'lblpopuplogin': 'login_lblpopuplogin'
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

    Apperyio.mappings["login_log_in_onsuccess_mapping_0"] = {
        "homeScreen": "login",
        "directions": [

        {
            "from_name": "log_in",
            "from_type": "SERVICE_RESPONSE",

            "to_name": "Name",
            "to_type": "LOCAL_STORAGE",

            "mappings": [

            {

                "source": "$['body']['Name']",
                "target": "$"

            }

            ]
        },

        {
            "from_name": "log_in",
            "from_type": "SERVICE_RESPONSE",

            "to_name": "CustomerID",
            "to_type": "LOCAL_STORAGE",

            "mappings": [

            {

                "source": "$['body']['CustomerID']",
                "target": "$"

            }

            ]
        },

        {
            "from_name": "log_in",
            "from_type": "SERVICE_RESPONSE",

            "to_name": "Email",
            "to_type": "LOCAL_STORAGE",

            "mappings": [

            {

                "source": "$['body']['Email']",
                "target": "$"

            }

            ]
        },

        {
            "from_name": "log_in",
            "from_type": "SERVICE_RESPONSE",

            "to_name": "status",
            "to_type": "LOCAL_STORAGE",

            "mappings": [

            {

                "source": "$['body']['status']",
                "target": "$"

            }

            ]
        },

        {
            "from_name": "log_in",
            "from_type": "SERVICE_RESPONSE",

            "to_name": "login",
            "to_type": "UI",

            "mappings": [

            {

                "source": "$['body']['status']",
                "target": "$['lblpopuplogin:text']"

            }

            ]
        }

        ]
    };

    Apperyio.mappings["login_log_in_onbeforesend_mapping_0"] = {
        "homeScreen": "login",
        "directions": [

        {
            "from_name": "login",
            "from_type": "UI",

            "to_name": "log_in",
            "to_type": "SERVICE_REQUEST",

            "to_default": {
                "headers": {},
                "parameters": {},
                "body": null
            },

            "mappings": [

            {

                "source": "$['lblLoginEmail:text']",
                "target": "$['parameters']['email']"

            }

            ]
        }

        ]
    };

    Apperyio.datasources = Apperyio.datasources || {};

    window.log_in = Apperyio.datasources.log_in = new Apperyio.DataSource(LogIn, {
        "onBeforeSend": function(jqXHR) {
            Apperyio.processMappingAction(Apperyio.mappings["login_log_in_onbeforesend_mapping_0"]);
        },
        "onComplete": function(jqXHR, textStatus) {

        },
        "onSuccess": function(data) {
            Apperyio.processMappingAction(Apperyio.mappings["login_log_in_onsuccess_mapping_0"]);
            var popupElement = Apperyio("mobilepopup_9");
            if (popupElement.popup("option", "positionTo") === "origin") {
                popupElement.popup("open", {
                    transition: "none",
                    positionTo: "#" + $(this).attr("id")
                });
            } else {
                popupElement.popup("open", {
                    transition: "none"
                });
            };
            var PopUp = Apperyio('lblpopuplogin');

            if (PopUp.text() == 'success') {
                Apperyio.navigateTo('welcome', {});
            };
        },
        "onError": function(jqXHR, textStatus, errorThrown) {}
    });

    Apperyio.CurrentScreen = 'login';
    _.chain(Apperyio.mappings).filter(function(m) {
        return m.homeScreen === Apperyio.CurrentScreen;
    }).each(Apperyio.UIHandler.hideTemplateComponents);

    /*
     * Events and handlers
     */

    // On Load
    var login_onLoad = function() {
            login_elementsExtraJS();

            login_deviceEvents();
            login_windowEvents();
            login_elementsEvents();
        };

    // screen window events


    function login_windowEvents() {

        $('#login').bind('pageshow orientationchange', function() {
            var _page = this;
            adjustContentHeightWithPadding(_page);
        });

    };

    // device events


    function login_deviceEvents() {
        document.addEventListener("deviceready", function() {

        });
    };

    // screen elements extra js


    function login_elementsExtraJS() {
        // screen (login) extra code

        /* mobilepopup_9 */
        $("#login_mobilepopup_9").popup("option", "positionTo", "window");

    };

    // screen elements handler


    function login_elementsEvents() {
        $(document).on("click", "a :input,a a,a fieldset label", function(event) {
            event.stopPropagation();
        });

        $(document).off("click", '#login_mobilecontainer [name="btnLoginSubmit"]').on({
            click: function(event) {
                if (!$(this).attr('disabled')) {
                    try {
                        log_in.execute({});
                    } catch (e) {
                        console.error(e);
                        hideSpinner();
                    };

                }
            },
        }, '#login_mobilecontainer [name="btnLoginSubmit"]');

    };

    $(document).off("pagebeforeshow", "#login").on("pagebeforeshow", "#login", function(event, ui) {
        Apperyio.CurrentScreen = "login";
        _.chain(Apperyio.mappings).filter(function(m) {
            return m.homeScreen === Apperyio.CurrentScreen;
        }).each(Apperyio.UIHandler.hideTemplateComponents);
    });

    login_onLoad();
};

$(document).off("pagecreate", "#login").on("pagecreate", "#login", function(event, ui) {
    Apperyio.processSelectMenu($(this));
    login_js();
});