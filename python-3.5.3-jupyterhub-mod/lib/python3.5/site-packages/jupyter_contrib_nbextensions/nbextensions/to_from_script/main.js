define([
    'jquery',
    'base/js/namespace',
], function (
    $,
    Jupyter
) {
    'use strict';

    var mod_name = 'nb2script2nb';
    var log_pref = '[' + mod_name + ']';
 
    var options = {
    };

    function load_ipython_extension () {

        Jupyter.notebook.config.loaded 
        .then(function () {
            $.extend(true, options, Jupyter.notebook.config[mod_name]);
        }, function (err) {
            console.warn(log_pref, 'Error loading config:', err);
        })
        .then(function () {
            $('#notebook-container').css({
                'width': 'auto',
                'margin-left': '10px',
                'margin-right': '10px'
            });
        }).catch(function (err) {
            console.warn(log_pref, 'Error:', err);
        });
    }

    return {
        load_ipython_extension : load_ipython_extension,
    };
});
