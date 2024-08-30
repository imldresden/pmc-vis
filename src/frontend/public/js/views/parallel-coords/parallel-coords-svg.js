// Adapted from: https://gist.github.com/mbostock/1341021
// d3v7 brushing example https://observablehq.com/@d3/brushable-parallel-coordinates

import makeCtxMenu from "./ctx-menu.js";

const parallelCoords = function (pane, data, metadata) {
    const selections = new Map(); // stores dimension -> brush selection
    const highlighted = new Set(); // stores hover highlighting, always a subset of selections
    let selected = {}; // stores data selection 
    let extents = {}; // for preserving brushes on nominals and booleans
    let dimensions;
    let pcpHtml;

    const publicFunctions = {
        destroy: function () {
            Object.values(pcpHtml).forEach(l => {
                const layer = document.getElementById(l);
                if (layer) {
                    layer.remove();
                }
            });
            removeEventListener("paneResize", resize, true);
        },
        getSelection: function () {
            return Object.values(selected).map(d => {
                const returnable = {};
                metadata.cols.forEach(c => {
                    returnable[c] = d[c];
                });
                returnable.id = d.id;
                return returnable;
            });
        }
    };

    function draw(pane, data) {
        const where = {
            id: pane.details,
            width: pane.width,
            height: pane.height * pane.split, // document.getElementById(pane.details).getBoundingClientRect().height,
        };

        function getPCPID(str) {
            return str + where.id;
        }

        pcpHtml = {
            div: getPCPID("pcp"),
        }

        d3.selectAll('#' + pcpHtml.div).remove();

        const cols = metadata.cols;
        let longestLabel = cols[0].length;
        cols.forEach(c => {
            longestLabel = c.length > longestLabel ? c.length : longestLabel;
        });

        const labelMargin = longestLabel * 3;

        // determines whether the plot appears vertically or horizontally
        const orient = where.width < where.height ? 0 : 1; // 0 horizontal, 1 vertical

        // set up some margins and dimensions for the svg
        const pad = 50;
        const brush_width = 8;

        const margin = {
            top: (pad - 20) + (orient ? labelMargin / 5 : 0),
            right: pad + (orient ? labelMargin : 0),
            bottom: pad / 2,
            left: pad + (orient ? 0 : labelMargin)
        },
            width = where.width - margin.left - margin.right,
            height = where.height - margin.top - margin.bottom;

        if (width < 10 || height < 10) {
            return; // do not draw
        }

        // variables to draw the plot vertically or horizontally
        const resp = {
            axes: {},
            scale: d3.scalePoint().range([0, orient ? width : height], 1),
            scale_orient: [d3.axisTop(), d3.axisLeft()],
            svg_dims: [width, height],
            w_h: ["width", "height"],
            x_y: ["x", "y"],
            anchor: ["end", "start"],
            trans: ["translate(0, ", "translate("]
        };

        let dragging = {};

        // variables to handle data points 
        let line = d3.line();
        let axis = resp.scale_orient[orient].ticks(
            Math.max(2, Math.trunc((resp.svg_dims[orient]) / 100, 0))
        );

        // make the base svg for parallel coordinates
        const svg = d3.select('#' + where.id)
            .append("svg")
            .attr("id", pcpHtml.div)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        document.getElementById(pcpHtml.div).onmousedown = () => {
            setPane(pane.id);
        }

        // get list of dimensions and create a scale for each, considering the data types.
        resp.scale.domain(dimensions = cols.filter(function (d) {
            if (metadata.nominals.includes(d)) {
                const domain = data.map(function (p) { return p[d].value; });
                const axis = resp.axes[d] = d3.scalePoint()
                    .domain(domain)
                    .range([0, resp.svg_dims[orient]])
                    .padding(1);

                axis.linear = d3.scaleLinear()
                    .domain([0, resp.svg_dims[orient]])
                    .range([0, resp.svg_dims[orient]])

                axis.invert = function (pos) {
                    return axis.linear(pos);
                }

                axis.mapping = {};
                axis.domain().forEach(d => {
                    axis.mapping[d] = axis(d)
                });
                return axis;
            } else if (metadata.booleans.includes(d)) {
                const axis = resp.axes[d] = d3.scalePoint()
                    .domain([false, true])
                    .range([0, resp.svg_dims[orient]])
                    .padding(1);

                axis.linear = d3.scaleLinear()
                    .domain([0, resp.svg_dims[orient]])
                    .range([0, resp.svg_dims[orient]]);

                axis.invert = function (pos) {
                    return axis.linear(pos);
                }

                axis.mapping = {};
                axis.domain().forEach(d => {
                    axis.mapping[d] = axis(d);
                });
                return axis;
            } else if (metadata.data_id != d) { // numbers
                const extent = d3.extent(data, function (p) { return +p[d].value; });
                if (extent[0] === extent[1]) {
                    extent[1] = extent[0] + 1;
                }

                // start/end on 0 when possible
                if (extent[0] > 0) {
                    extent[0] = 0;
                }

                if (extent[1] < 0) {
                    extent[1] = 0;
                }

                return (resp.axes[d] = d3.scaleLinear()
                    .domain([extent[1], extent[0]])
                    .range([0, resp.svg_dims[orient]]));
            }
        }));

        // hover highlighting: background and cursor area visual indicator
        // both of these are before fg and bg to not interfere with other events
        svg.append("rect")
            .attr("class", "backgroundRect")
            .attr("width", width)
            .attr("height", height)
            .attr("opacity", 0);
        const cursor_rect = svg.append('rect')
            .attr('class', 'cursor-area')
            .attr('width', 0)
            .attr('height', 0);
        const count_tooltip = svg.append('text')
            .attr('class', 'selection-count-tooltip');

        // background lines for context.
        const background = svg.append("g")
            .attr("class", "background")
            .selectAll("path")
            .data(data)
            .enter()
            .append("path")
            .attr("d", path);

        // foreground lines for focus.
        const foreground = svg.append("g")
            .attr("class", "foreground")
            .selectAll("path")
            .data(data)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("stroke", d => getComputedStyle(document.getElementById(pane.container)).getPropertyValue(d.color));

        // applies effect over duration
        function transition(g) {
            return g.transition().duration(500);
        }

        function checkIfActive(point) {
            return Array.from(selections).every(
                ([key, [min, max]]) => {
                    const val = point[key].type === 'ordinal' ?
                        point[key].value :
                        resp.axes[key].mapping[point[key].value];
                    return val >= min && val <= max;
                }
            );
        }

        function getAxisId(d) {
            return pane.id + "_axis_" + d
        }   

        // group element for each dimension and add drag motion
        const g = svg.selectAll(".dimension")
            .data(dimensions)
            .enter()
            .append("g")
            .attr("class", "dimension")
            .attr("id", function (d) {
                return getAxisId(d)
            })
            .attr("class", (d) => {
                return "dimension";
            })
            .on("contextmenu", (e, d) => {
                e.axisName = d; // attaches axis information to the event for context menu
            })
            .attr("transform", function (d) { return resp.trans[orient] + resp.scale(d) + ")"; })
            // axes re-ordering
            .call(d3.drag()
                .subject(function (d) {
                    if (orient) {
                        return { x: resp.scale(d) };
                    } else {
                        return { y: resp.scale(d) };
                    }
                })
                .on("start", function (e, d) {
                    dragging[d] = resp.scale(d);
                    background.attr("visibility", "hidden");
                })
                .on("drag", function (e, d) {
                    dragging[d] = orient ?
                        e.subject.x = Math.min(width + margin.right, Math.max(-margin.left, e.x)) :
                        e.subject.y = Math.min(height + margin.bottom, Math.max(-margin.top, e.y));
                    foreground.attr("d", path);
                    dimensions.sort(basic_sort);
                    resp.scale.domain(dimensions);
                    g.attr("transform", function (d) { return resp.trans[orient] + position(d) + ")"; })
                })
                .on("end", function (e, d) {
                    delete dragging[d];
                    transition(d3.select(this)).attr("transform", resp.trans[orient] + resp.scale(d) + ")");
                    transition(foreground).attr("d", path);

                    background
                        .attr("d", path)
                        .transition()
                        .delay(500)
                        .duration(0)
                        .attr("visibility", null);
                })
            );

        const countTooltipUpdate = _.throttle((tooltip, mouse, text) => {            
            tooltip.attr('x', mouse[0] + 10)
            tooltip.attr('y', mouse[1] - 10);

            tooltip.text(text)
        }, 50);


        // cursor logic
        svg.on("mousemove", function (e) {
            const mouse = d3.pointer(e);  // [x, y]
            const cursor_pad = 20;

            // compute closest dimension
            let dim = dimensions[0];
            for (const i of dimensions) {
                if (Math.abs(position(dim) - mouse[1 - orient]) > Math.abs(position(i) - mouse[1 - orient])) {
                    dim = i;
                }
            }

            // disallow highlighting if outside cursor area wrt axes locations
            const mouse_scale_pos = resp.axes[dim].invert(mouse[orient]);
            const pixelRange = resp.axes[dim].range();
            const range = [resp.axes[dim].invert(pixelRange[0]), resp.axes[dim].invert(pixelRange[1])];
            
            if (Math.abs(position(dim) - mouse[1 - orient]) > cursor_pad ||
                !(mouse_scale_pos > Math.max(range[0], range[1]))
                    && mouse_scale_pos < Math.min(range[0], range[1])
            ) {
                background.attr("class", null);

                cursor_rect.attr(resp.w_h[orient], 0);
                cursor_rect.attr(resp.w_h[1 - orient], 0);
                count_tooltip.text('');
                return;
            }

            // compute cursor area wrt the scale value
            const mouse_upper_limit = resp.axes[dim].invert(mouse[orient] + cursor_pad);
            const mouse_lower_limit = resp.axes[dim].invert(mouse[orient] - cursor_pad);

            // update visual indicator
            cursor_rect.attr(resp.w_h[1 - orient], cursor_pad);
            cursor_rect.attr(resp.w_h[orient], cursor_pad * 2);
            cursor_rect.attr(resp.x_y[1 - orient], position(dim) - cursor_pad / 2);
            cursor_rect.attr(resp.x_y[orient], mouse[orient] - cursor_pad);

            // compare against mouse value only on closest dimension and within brush selections
            background.attr("class", function (point) {
                const active = checkIfActive(point);

                const val = point[dim].type === 'ordinal' ? point[dim].value : resp.axes[dim].mapping[point[dim].value];
                if (active && val < mouse_upper_limit && val > mouse_lower_limit) {
                    highlighted.add(point.id);
                    return "highlighted-path";
                } else {
                    highlighted.delete(point.id);
                    return null;
                }
            });

            countTooltipUpdate(count_tooltip, mouse, highlighted.size);
        });

        // axes and title.
        g.append("g")
            .attr("class", "axis")
            .each(function (d) { d3.select(this).call(axis.scale(resp.axes[d])); })
            .append("text")
            .attr("text-anchor", resp.anchor[orient])
            .attr("transform", "rotate(-10)")
            .attr(resp.x_y[orient], -12)
            .text(String);

        // add and store a brush for each axis.
        const brushes = {};
        g.append("g")
            .attr("class", "brush")
            .attr("id", (d) => "brush-"+getAxisId(d))
            .each(function (d) {
                brushes["brush-"+getAxisId(d)] = this;
                if (orient) {
                    d3.select(this).call(
                        resp.axes[d].brush = d3.brushY()
                            .extent([
                                [-brush_width, 0],
                                [brush_width, height]
                            ])
                    );
                } else {
                    d3.select(this).call(
                        resp.axes[d].brush = d3.brushX()
                            .extent([
                                [0, -brush_width],
                                [width, brush_width]
                            ])
                    );
                }

                // preserve selections on redraw
                if (selections.get(d)) {
                    if (!extents[d]) {
                        d3.select(this).call(resp.axes[d].brush.move, [
                            resp.axes[d](selections.get(d)[0]),
                            resp.axes[d](selections.get(d)[1])
                        ]);
                    } else {
                        const trans = d3
                            .scaleLinear()
                            .domain(extents[d])
                            .range(resp.axes[d].linear.domain());

                        selections.set(d, [trans(selections.get(d)[0]), trans(selections.get(d)[1])]);

                        d3.select(this).call(resp.axes[d].brush.move, [
                            resp.axes[d].linear(selections.get(d)[0]),
                            resp.axes[d].linear(selections.get(d)[1])
                        ]);
                    }
                }

                // saves the extents of nominals and booleans so that they can be computed on resize
                if (resp.axes[d].linear) {
                    extents[d] = resp.axes[d].linear.domain();
                }

                resp.axes[d].brush
                    .on("start", brush_start)
                    .on("brush", brush)
                    .on("end", brush) // updates brush if clicked elsewhere on axis
            });

        // returns the dimension in x/y or modified in dragging
        function position(d) {
            const v = dragging[d];
            return v == null ? resp.scale(d) : v;
        }

        // returns the path for a given data point - this maps the generated x/y function for each of the data points to every dimension
        function path(d) {
            return orient ?
                line(dimensions.map(function (p) {
                    return [position(p), resp.axes[p](d[p].value)];
                })) :
                line(dimensions.map(function (p) {
                    return [resp.axes[p](d[p].value), position(p)];
                }));
        }

        function brush_start(e) {
            e.sourceEvent.stopPropagation();
        }

        // handles a brush event, updates selections 
        function brush({ selection }, key) {
            if (selection === null || selection[0] === selection[1]) {
                selections.delete(key);
            } else {
                selections.set(key, selection.map(resp.axes[key].invert));
            }

            drawBrushed();
            updateCountStrings();
        }

        function drawBrushed() {
            // get lines within extents
            foreground.style("display", function (d) {
                if (checkIfActive(d)) {
                    selected[d.id] = d;
                    return null;
                } else {
                    return "none";
                }
            });
        }

        // sorting function by value, used in scales for each numerical dimension
        function basic_sort(a, b) {
            return position(a) - position(b);
        }

        function drawBrushMinMax(data, name, pane, min=true) {
            d3.select(brushes["brush-"+getAxisId(name)]).call(d3.brush().clear);
            
            const extent = d3.extent(data, function (p) { 
                return +p[name].value; 
            });

            selections.set(name, [extent[min? 0 : 1], extent[min? 0 : 1]]);
            drawBrushed();
            updateCountStrings()
            
            dispatchEvent(new CustomEvent("linked-selection", {
                detail: {
                    pane: pane.id,
                    selection: publicFunctions.getSelection(),
                },
            }));
        }

        makeCtxMenu(pane.details, pane, publicFunctions, {
            condition: (e) => { 
                return true // return e.axis !== undefined;
            },
            extras: [
                {
                    label: "Select Minimum",
                    callback: (e) => {
                        if (!e.axisName) {
                            Swal.fire({
                                position: 'top-end',
                                icon: 'error',
                                title: 'No axis selected!',
                                timer: 1500, 
                                timerProgressBar: true
                            });
                            return;
                        }
                        drawBrushMinMax(data, e.axisName, pane, true);
                    },
                },
                {
                    label: "Select Maximum",
                    callback: (e) => {
                        if (!e.axisName) {
                            Swal.fire({
                                position: 'top-end',
                                icon: 'error',
                                title: 'No axis selected!',
                                timer: 1500, 
                                timerProgressBar: true
                            });
                            return;
                        }
                        drawBrushMinMax(data, e.axisName, pane, false);
                    },
                },
            ]
        });

        removeEventListener("paneResize", resize, true);
        addEventListener("paneResize", resize, true);
        drawBrushed();
        updateCountStrings();
        dispatchEvent(new CustomEvent("linked-selection", {
            detail: {
                pane: pane.id,
                selection: publicFunctions.getSelection(),
            },
        }));
    }

    function updateCountStrings() {
        const pcp_selection = publicFunctions.getSelection();
        const count = document.getElementById("count")
        const json = document.getElementById("json")

        if (count && json) {
            count.textContent = "Selected elements: " + pcp_selection.length;
            json.textContent = JSON.stringify(pcp_selection, undefined, 2);
        }
    }

    draw(pane, data);
    updateCountStrings();

    function resize(e) {
        // assigning it to this div disables it on remove()
        if (e.detail.pane && (e.detail.pane === 'all' || e.detail.pane.id === pane.id)) {
            draw(pane, data);
        }
    }

    return publicFunctions;
}

export { parallelCoords }
