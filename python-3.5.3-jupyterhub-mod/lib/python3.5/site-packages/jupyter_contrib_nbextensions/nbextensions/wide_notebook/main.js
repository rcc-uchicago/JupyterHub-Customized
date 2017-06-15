define([
    'base/js/namespace',
    'jquery'
], function (
    Jupyter,
    $
) {
    'use strict';

    var mod_name = 'wide_notebook';
    var log_pref = '[' + mod_name + ']';

    var options = {
        margin: -1,
    };

    function load_ipython_extension () {

        Jupyter.notebook.config.loaded
            .then(function on_success () {

            }, function on_error (reason) {
                console.warn(log_pref, 'Error loading config:', reason);
            })
            .then(function () {
                $('#notebook-container').css({
                    'width': 'auto',
                    'margin-left': '10px',
                    'margin-right': '10px'
                });
            }).catch(function on_error (reason) {
                console.warn(log_pref, 'Error:', reason);
            }
            );
    }

    return {
        load_ipython_extension : load_ipython_extension,
    };
});
