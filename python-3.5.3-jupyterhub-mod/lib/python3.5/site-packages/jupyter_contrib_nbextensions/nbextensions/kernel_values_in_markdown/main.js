// Allow Python-code in markdown cells
// Encapsulate using {{...}}
// - You can also return html or markdown from your Python code
// - You can embed images, however they will be sanitized on reload.

// TODO: Markdown cells will only be reevaluated when a notebook is dirty
//       (i.e. you have made changes). If you save it before reevaluating MD cells,
//       they will show the old value.

define(function (require, module, exports) {
    "use strict";

    var Jupyter = require('base/js/namespace');
    var $ = require('jquery');    
    var cell = require('notebook/js/cell');
    var marked = require('components/marked/lib/marked');
    var events = require('base/js/events');
    var textcell = require('notebook/js/textcell');
    var MarkdownCell = textcell.MarkdownCell;
    var TextCell = textcell.TextCell;

    /*
     * Find kernel expressions enclosed in {{ }}, execute and add to text as
     * <span> tags. The actual content gets filled in later by a callback.
     * Already executed expressions are cached in cell metadata.
     *
     * @method do_kernel_code_replacements
     * @param cell {Cell} notebook cell
     * @param text {String} text in cell
     */
    var do_kernel_code_replacements = function (cell, text) {
        /* never execute code in untrusted notebooks */
        if (Jupyter.notebook.trusted === false ) {
            return undefined;
        }
        /* always clear stored variables if notebook is dirty */
        if (Jupyter.notebook.dirty === true ) {
            delete cell.metadata.variables;
        }
        // search for code in double curly braces: {{}}
        var found = false;
        var newtext = text.replace(/{{(.*?)}}/g, function (match, kernel_expr, offset) {
            found = true;
            if (tag === "") {
                return undefined;
            }
            var code = tag;
            var id = 'python_' + cell.cell_id + '_' + offset; /* create an individual ID */
            var thiscell = cell;
            kernel_expr = tag;

            /* there a two possible options:
               a) notebook dirty or variable not stored in metadata: evaluate variable
               b) notebook clean and variable stored in metadata: display stored value
            */
            if (typeof cell.metadata.variables === "undefined") {
                cell.metadata.variables = {};
            }
            var val = cell.metadata.variables[kernel_expr];
            if (Jupyter.notebook.dirty !== true && val !== undefined && !jQuery.isEmptyObject(val)) {
                // Notebook clean & we have val cached in metadata
                val = cell.metadata.variables[tag];
                return "<span id='"+id+"'>"+val+"</span>";
            }
            else {
                // re-evaluate kernel_expr
                cell.metadata.variables[kernel_expr] = {};
                var execute_callback = function (msg) {
                    var html, t, q;
                    if (msg.msg_type === "error") {
                        var text = "**" + msg.content.ename + "**: " +  msg.content.evalue;
                        html = marked(text);
                    }
                    else if (msg.msg_type === "stream") {
                        html = marked(msg.content.text);
                        t = html.match(/<p>([\s\S]*?)<\/p>/)[1]; //strip <p> and </p> that marked adds and we don't want
                        html = t ? t : html;
                        q = html.match(/&#39;([\s\S]*?)&#39;/); // strip quotes from strings
                        if (q !== null) {
                            html = q[1];
                        }
                    }
                    else if (msg.msg_type === "execute_result" | msg.msg_type === "display_data" ) {
                        var ul = msg.content.data;
                        if (ul !== undefined) {
                            if (ul['text/latex'] !== undefined) {
                                html = ul['text/latex'];
                            }
                            else if (ul['image/svg+xml'] !== undefined) {
                                /* embed SVG in an <img> tag, still get eaten by sanitizer... */
                                var b64_svg = btoa(ul['image/svg+xml']);
                                html = '<img src="data:image/svg+xml;base64,' + b64_svg + '"/>';
                            }
                            else if (ul['image/jpeg'] !== undefined) {
                                var jpeg = ul['image/jpeg'];
                                html = '<img src="data:image/jpeg;base64,' + jpeg + '"/>';
                            }
                            else if (ul['image/png'] !== undefined) {
                                var png = ul['image/png'];
                                html = '<img src="data:image/png;base64,' + png + '"/>';
                            }
                            else if (ul['text/markdown'] !== undefined) {
                                html = marked(ul['text/markdown']);
                            }
                            else if (ul['text/html'] !== undefined) {
                                html = ul['text/html'];
                            }
                            else {
                                html = marked(ul['text/plain']);
                                // [\s\S] is used to also catch newlines
                                t = html.match(/<p>([\s\S]*?)<\/p>/)[1]; //strip <p> and </p> that marked adds and we don't want
                                html = t ? t : html;
                                q = html.match(/&#39;([\s\S]*?)&#39;/); // strip quotes from strings
                                if (q !== null) {
                                    html = q[1];
                                }
                            }
                        }
                    }
                    else {
                        return;
                    }
                    thiscell.metadata.variables[kernel_expr] = html;
                    var el = document.getElementById(id);
                    el.innerHTML = el.innerHTML + html; // output result
                };
                var callbacks = { iopub : { output: execute_callback } };
                if (cell.notebook.kernel !== null) {
                    cell.notebook.kernel.execute(code, callbacks, {silent: false, store_history : false, stop_on_error: false });
                    return "<span id='"+id+"'></span>"; // add HTML tag with ID where output will be placed
                }
                return undefined;
            }
        });
        if (found) {
            return newtext;
        }
        return undefined;
    };

    /*
     * Render markdown cell and replace {{...}} with python code
     *
     */
    var render_cell = function(cell) {
        var element = cell.element.find('div.text_cell_render');
        var text = do_kernel_code_replacements(cell, element[0].innerHTML);
        if (text !== undefined) {
            element[0].innerHTML = text;
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, element[0]]);
        }
    };

    function patch_markdowncell_render () {
        /* force rendering of markdown cell if notebook is dirty */
        var original_render = MarkdownCell.prototype.render;
        MarkdownCell.prototype.render = function() {
            if (Jupyter.notebook.dirty === true) {
                this.rendered = false;
            }
            return original_render.apply(this);
        };
    }

    var set_trusted_indicator = function() {
        var ind = $('#notebook-trusted-indicator');
        if (ind.length < 1) {
            ind = $('<i>')
                .attr('id', 'notebook-trusted-indicator')
                .addClass('fa')
                .appendTo('#save_widget');
        }
        if (Jupyter.notebook.trusted === true) {
            ind.attr('title', 'Notebook is trusted');
            ind.removeClass('fa-question');
            ind.addClass('fa-check');
        }
        else {
            ind.attr('title', 'Notebook is not trusted');
            ind.removeClass('fa-check');
            ind.addClass('fa-question');
        }
    };

   /**
     * Add CSS file
     *
     * @param name filename
     */
    var load_css = function (name) {
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl(name);
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    var load_ipython_extension = function () {
        load_css('./main.css');

        patch_markdowncell_render();

        events.on("rendered.MarkdownCell", function (event, data) {
            render_cell(data.cell);
        });
        events.on("trust_changed.Notebook", set_trusted_indicator);

        set_trusted_indicator();
        /* show values stored in metadata on reload */
        events.on("kernel_ready.Kernel", function () {
            var ncells = Jupyter.notebook.ncells();
            var cells = Jupyter.notebook.get_cells();
            for (var i = 0; i < ncells; i++) {
                var cell = cells[i];
                if (cell.metadata.hasOwnProperty('variables')) {
                    render_cell(cell);
                }
            }
        });
    };

    function patch_mdcell_render () {
        var old_mdcell_render = MarkdownCell.prototype.render;
        MarkdownCell.prototype.render = function () {
            var cont = TextCell.prototype.render.apply(this);
            if (cont) {
                var that = this;
                var text = this.get_text();
                var math = null;
                if (text === "") { text = this.placeholder; }
                var text_and_math = mathjaxutils.remove_math(text);
                text = text_and_math[0];
                math = text_and_math[1];
                marked(text, function (err, html) {
                    html = mathjaxutils.replace_math(html, math);
                    html = security.sanitize_html(html);
                    html = $($.parseHTML(html));
                    // add anchors to headings
                    html.find(":header").addBack(":header").each(function (i, h) {
                        h = $(h);
                        var hash = h.text().replace(/ /g, '-');
                        h.attr('id', hash);
                        h.append(
                            $('<a/>')
                                .addClass('anchor-link')
                                .attr('href', '#' + hash)
                                .text('¶')
                                .on('click',function(){
                                    setTimeout(function(){that.unrender(); that.render()}, 100)
                                })
                        );
                    });
                    // links in markdown cells should open in new tabs
                    html.find("a[href]").not('[href^="#"]').attr("target", "_blank");
                    that.set_rendered(html);
                    that.typeset();
                    that.events.trigger("rendered.MarkdownCell", {cell: that});
                });
            }
            return cont;
        };
    }


    return {
        load_ipython_extension : load_ipython_extension
    };
});
