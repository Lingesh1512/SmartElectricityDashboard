/* =========================================================
   SMART ELECTRICITY USAGE DASHBOARD
   Full JavaScript Code
   ========================================================= */

"use strict";

/* ---------- Constants ---------- */

const APPLIANCES = [
    "Air Conditioner",
    "Refrigerator",
    "Washing Machine",
    "Television",
    "Lights",
    "Fan",
    "Other Appliances"
];

const COLORS = [
    "#00e5ff",
    "#007bff",
    "#6c5ce7",
    "#ff3cac",
    "#00ff9d",
    "#ff9f43",
    "#9b59ff"
];

const PAGE_SIZE = 10;


/* ---------- Helper ---------- */

const $ = id => document.getElementById(id);

const inr = n => "₹" + Number(n).toFixed(2);

const monthKey = date => date.slice(0, 7);

const monthName = key =>
    new Date(key + "-01").toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
    });

const sum = (arr, fn) =>
    arr.reduce((total, item) => total + fn(item), 0);

const cssVar = name =>
    getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();


/* ---------- Application State ---------- */

const state = {
    all: [],
    month: "all",
    app: "all",
    search: "",
    sortKey: "date",
    sortDir: 1,
    page: 1
};

const charts = {};

const shown = {};


/* =========================================================
   NUMBER ANIMATION
   ========================================================= */

function countTo(element, value, decimals = 2, prefix = "") {

    if (!element) return;

    const from = shown[element.id] || 0;
    const startTime = performance.now();
    const duration = 1000;

    shown[element.id] = value;

    function frame(currentTime) {

        const progress = Math.min(
            (currentTime - startTime) / duration,
            1
        );

        const easing =
            1 - Math.pow(1 - progress, 3);

        const current =
            from + (value - from) * easing;

        element.textContent =
            prefix + current.toFixed(decimals);

        if (progress < 1) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}


/* =========================================================
   LOAD JSON DATA
   ========================================================= */

async function loadData() {

    try {

        const response =
            await fetch("electricity-data.json");

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }

        const json =
            await response.json();

        if (!json.records || !Array.isArray(json.records)) {
            throw new Error(
                "Invalid JSON format. 'records' array not found."
            );
        }

        state.all = json.records;

        init();

    } catch (error) {

        console.error("Data loading error:", error);

        $("loader").classList.add("done");

        const errorBox = $("error");

        errorBox.hidden = false;

        errorBox.innerHTML = `
            <b>Could not load electricity-data.json.</b>
            <br><br>
            Make sure:
            <br>
            1. electricity-data.json is in the same folder as index.html
            <br>
            2. You are using Live Server
            <br>
            3. The JSON file contains a "records" array
            <br><br>
            Error: ${error.message}
        `;
    }
}


/* =========================================================
   FILTERING
   ========================================================= */

function filtered(withSearch = false) {

    const query =
        state.search.trim().toLowerCase();

    return state.all.filter(record => {

        const monthMatch =
            state.month === "all" ||
            monthKey(record.date) === state.month;

        const applianceMatch =
            state.app === "all" ||
            record.appliance === state.app;

        const searchMatch =
            !withSearch ||
            !query ||
            (
                record.date +
                " " +
                record.day +
                " " +
                record.appliance
            )
                .toLowerCase()
                .includes(query);

        return (
            monthMatch &&
            applianceMatch &&
            searchMatch
        );
    });
}


/* =========================================================
   GROUP DATA BY DATE
   ========================================================= */

function byDate(rows) {

    const result = {};

    rows.forEach(record => {

        if (!result[record.date]) {
            result[record.date] = 0;
        }

        result[record.date] +=
            Number(record.consumption);
    });

    return Object.keys(result)
        .sort()
        .map(date => ({
            date: date,
            kwh: Number(result[date].toFixed(2))
        }));
}


/* =========================================================
   GROUP DATA BY APPLIANCE
   ========================================================= */

function byAppliance(rows) {

    return APPLIANCES.map(appliance => {

        const records =
            rows.filter(
                record =>
                    record.appliance === appliance
            );

        return {

            name: appliance,

            kwh: sum(
                records,
                record =>
                    Number(record.consumption)
            ),

            cost: sum(
                records,
                record =>
                    Number(record.cost)
            ),

            count: records.length
        };
    });
}


/* =========================================================
   CHART DEFAULTS
   ========================================================= */

function setupChartDefaults() {

    if (typeof Chart === "undefined") {
        console.error(
            "Chart.js is not loaded."
        );
        return;
    }

    Chart.defaults.color =
        cssVar("--muted") || "#8e9bc7";

    Chart.defaults.borderColor =
        cssVar("--grid") ||
        "rgba(255,255,255,.07)";

    Chart.defaults.font.family =
        "Segoe UI, system-ui, sans-serif";
}


/* =========================================================
   SPARKLINE CHART
   ========================================================= */

function sparkChart(id, color) {

    return new Chart($(id), {

        type: "line",

        data: {

            labels: [],

            datasets: [{

                data: [],

                borderColor: color,

                borderWidth: 2,

                pointRadius: 0,

                tension: 0.4,

                fill: true,

                backgroundColor:
                    color + "33"
            }]
        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            animation: {
                duration: 1200
            },

            events: [],

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {
                    enabled: false
                }
            },

            scales: {

                x: {
                    display: false
                },

                y: {
                    display: false
                }
            }
        }
    });
}


/* =========================================================
   BUILD ALL CHARTS
   ========================================================= */

function buildCharts() {

    setupChartDefaults();


    /* ---------- KPI SPARKLINES ---------- */

    const sparkData = [
        ["s1", "#00e5ff"],
        ["s2", "#ff3cac"],
        ["s3", "#00ff9d"],
        ["s4", "#ff9f43"]
    ];

    sparkData.forEach(item => {

        const id = item[0];
        const color = item[1];

        charts[id] =
            sparkChart(id, color);
    });


    /* =====================================================
       DAILY CONSUMPTION LINE CHART
       ===================================================== */

    charts.line = new Chart(
        $("lineChart"),
        {

            type: "line",

            data: {

                labels: [],

                datasets: [{

                    label:
                        "Consumption (kWh)",

                    data: [],

                    tension: 0.4,

                    borderWidth: 3,

                    fill: true,


                    /* ---------- SAFE LINE GRADIENT ---------- */

                    borderColor: function (context) {

                        const chart =
                            context.chart;

                        const area =
                            chart.chartArea;

                        if (!area) {
                            return "#00e5ff";
                        }

                        const gradient =
                            chart.ctx.createLinearGradient(
                                area.left,
                                0,
                                area.right,
                                0
                            );

                        gradient.addColorStop(
                            0,
                            "#00e5ff"
                        );

                        gradient.addColorStop(
                            0.5,
                            "#9b59ff"
                        );

                        gradient.addColorStop(
                            1,
                            "#ff3cac"
                        );

                        return gradient;
                    },


                    /* ---------- SAFE AREA GRADIENT ---------- */

                    backgroundColor: function (context) {

                        const chart =
                            context.chart;

                        const area =
                            chart.chartArea;

                        if (!area) {
                            return "rgba(0,229,255,0.1)";
                        }

                        const gradient =
                            chart.ctx.createLinearGradient(
                                0,
                                area.top,
                                0,
                                area.bottom
                            );

                        gradient.addColorStop(
                            0,
                            "rgba(0,229,255,0.3)"
                        );

                        gradient.addColorStop(
                            1,
                            "rgba(155,89,255,0)"
                        );

                        return gradient;
                    },

                    pointRadius: 4,

                    pointHoverRadius: 8,

                    pointBackgroundColor:
                        "#00e5ff",

                    pointBorderColor:
                        "#ffffff",

                    pointBorderWidth: 1
                }]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                animation: {

                    duration: 1400,

                    easing: "easeOutQuart"
                },

                interaction: {

                    mode: "index",

                    intersect: false
                },

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {

                        callbacks: {

                            label: function (context) {

                                return (
                                    Number(
                                        context.parsed.y
                                    ).toFixed(2)
                                    +
                                    " kWh"
                                );
                            }
                        }
                    }
                },

                scales: {

                    x: {

                        title: {

                            display: true,

                            text: "Date"
                        },

                        ticks: {

                            maxRotation: 60
                        }
                    },

                    y: {

                        beginAtZero: true,

                        title: {

                            display: true,

                            text:
                                "Consumption (kWh)"
                        }
                    }
                }
            }
        }
    );


    /* =====================================================
       COST BAR CHART
       ===================================================== */

    charts.bar = new Chart(
        $("barChart"),
        {

            type: "bar",

            data: {

                labels: APPLIANCES,

                datasets: [{

                    label: "Cost (INR)",

                    data: [],

                    borderRadius: 8,

                    backgroundColor:
                        function (context) {

                            const chart =
                                context.chart;

                            const area =
                                chart.chartArea;

                            const index =
                                Number.isInteger(
                                    context.dataIndex
                                )
                                    ? context.dataIndex
                                    : 0;

                            const color =
                                COLORS[
                                    index %
                                    COLORS.length
                                ] || "#00e5ff";

                            if (!area) {
                                return color;
                            }

                            const gradient =
                                chart.ctx.createLinearGradient(
                                    0,
                                    area.bottom,
                                    0,
                                    area.top
                                );

                            gradient.addColorStop(
                                0,
                                color + "55"
                            );

                            gradient.addColorStop(
                                1,
                                color
                            );

                            return gradient;
                        }
                }]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                animation: {

                    duration: 1200
                },

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {

                        callbacks: {

                            label:
                                function (context) {

                                    return inr(
                                        context.parsed.y
                                    );
                                }
                        }
                    }
                },

                scales: {

                    y: {

                        beginAtZero: true,

                        title: {

                            display: true,

                            text: "Cost (INR)"
                        },

                        ticks: {

                            callback:
                                value =>
                                    "₹" + value
                        }
                    },

                    x: {

                        ticks: {

                            maxRotation: 45
                        }
                    }
                }
            }
        }
    );


    /* =====================================================
       DOUGHNUT CHART
       ===================================================== */

    charts.donut = new Chart(
        $("donutChart"),
        {

            type: "doughnut",

            data: {

                labels: APPLIANCES,

                datasets: [{

                    data: [],

                    backgroundColor:
                        COLORS,

                    borderColor:
                        "transparent",

                    hoverOffset: 12
                }]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                cutout: "62%",

                animation: {

                    animateRotate: true,

                    duration: 1400
                },

                plugins: {

                    legend: {

                        position: "right",

                        labels: {

                            usePointStyle: true,

                            generateLabels:
                                function (chart) {

                                    const data =
                                        chart
                                            .data
                                            .datasets[0]
                                            .data;

                                    const total =
                                        data.reduce(
                                            (a, b) =>
                                                a + b,
                                            0
                                        ) || 1;

                                    return chart
                                        .data
                                        .labels
                                        .map(
                                            (
                                                label,
                                                index
                                            ) => {

                                                const value =
                                                    Number(
                                                        data[
                                                            index
                                                        ] || 0
                                                    );

                                                return {

                                                    text:
                                                        `${label}: ${value.toFixed(2)} kWh (${(value / total * 100).toFixed(1)}%)`,

                                                    fillStyle:
                                                        COLORS[
                                                            index %
                                                            COLORS.length
                                                        ],

                                                    strokeStyle:
                                                        COLORS[
                                                            index %
                                                            COLORS.length
                                                        ],

                                                    fontColor:
                                                        cssVar(
                                                            "--text"
                                                        ) ||
                                                        "#ffffff",

                                                    index:
                                                        index,

                                                    hidden:
                                                        false,

                                                    pointStyle:
                                                        "circle"
                                                };
                                            }
                                        );
                                }
                        }
                    },

                    tooltip: {

                        callbacks: {

                            label:
                                function (context) {

                                    const data =
                                        context
                                            .dataset
                                            .data;

                                    const total =
                                        data.reduce(
                                            (a, b) =>
                                                a + b,
                                            0
                                        ) || 1;

                                    const value =
                                        Number(
                                            context.parsed
                                        );

                                    return (
                                        value.toFixed(2)
                                        +
                                        " kWh ("
                                        +
                                        (
                                            value /
                                            total *
                                            100
                                        ).toFixed(1)
                                        +
                                        "%)"
                                    );
                                }
                        }
                    }
                }
            }
        }
    );
}


/* =========================================================
   UPDATE CHARTS
   ========================================================= */

function updateCharts(rows) {

    const days =
        byDate(rows);

    const appliances =
        byAppliance(rows);


    /* ---------- LINE CHART ---------- */

    charts.line.data.labels =
        days.map(day =>
            new Date(day.date)
                .toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short"
                    }
                )
        );

    charts.line.data.datasets[0].data =
        days.map(day => day.kwh);


    /* ---------- BAR CHART ---------- */

    charts.bar.data.datasets[0].data =
        appliances.map(
            appliance =>
                Number(
                    appliance.cost.toFixed(2)
                )
        );


    /* ---------- DOUGHNUT ---------- */

    charts.donut.data.datasets[0].data =
        appliances.map(
            appliance =>
                Number(
                    appliance.kwh.toFixed(2)
                )
        );


    /* ---------- SPARKLINES ---------- */

    let runningTotal = 0;

    const cumulative =
        days.map(day => {

            runningTotal += day.kwh;

            return Number(
                runningTotal.toFixed(2)
            );
        });


    const series = [

        cumulative,

        cumulative.map(
            value => value * 7
        ),

        days.map(
            day => day.kwh
        ),

        days.map(
            (_, index) => index + 1
        )
    ];


    ["s1", "s2", "s3", "s4"]
        .forEach((id, index) => {

            charts[id]
                .data
                .labels =
                series[index];

            charts[id]
                .data
                .datasets[0]
                .data =
                series[index];
        });


    /* ---------- UPDATE ALL ---------- */

    Object.values(charts)
        .forEach(chart => {

            if (chart) {
                chart.update();
            }
        });
}


/* =========================================================
   UPDATE KPI CARDS
   ========================================================= */

function updateKpis(rows) {

    const total =
        sum(
            rows,
            record =>
                Number(record.consumption)
        );

    const cost =
        sum(
            rows,
            record =>
                Number(record.cost)
        );

    const days =
        new Set(
            rows.map(
                record => record.date
            )
        ).size;


    countTo(
        $("kTotal"),
        total
    );

    countTo(
        $("kCost"),
        cost,
        2,
        "₹"
    );

    countTo(
        $("kAvg"),
        days
            ? total / days
            : 0
    );

    countTo(
        $("kDays"),
        days,
        0
    );
}


/* =========================================================
   UPDATE ANALYTICS
   ========================================================= */

function updateAnalytics(rows) {

    const days =
        byDate(rows);

    const appliances =
        byAppliance(rows)
            .filter(
                appliance =>
                    appliance.count > 0
            );

    const total =
        sum(
            rows,
            record =>
                Number(record.consumption)
        );

    const cost =
        sum(
            rows,
            record =>
                Number(record.cost)
        );


    function setValue(
        id,
        text,
        subText
    ) {

        const main =
            $(id);

        const sub =
            $(id + "Sub");

        if (main) {
            main.textContent = text;
        }

        if (sub) {
            sub.textContent = subText;
        }
    }


    /* ---------- HIGHEST / LOWEST ---------- */

    if (days.length > 0) {

        const highest =
            days.reduce(
                (a, b) =>
                    b.kwh > a.kwh
                        ? b
                        : a
            );

        const lowest =
            days.reduce(
                (a, b) =>
                    b.kwh < a.kwh
                        ? b
                        : a
            );


        setValue(
            "aHigh",
            highest.date,
            highest.kwh.toFixed(2) +
                " kWh"
        );

        setValue(
            "aLow",
            lowest.date,
            lowest.kwh.toFixed(2) +
                " kWh"
        );

    } else {

        setValue(
            "aHigh",
            "-",
            ""
        );

        setValue(
            "aLow",
            "-",
            ""
        );
    }


    /* ---------- APPLIANCE ANALYSIS ---------- */

    if (appliances.length > 0) {

        const expensive =
            appliances.reduce(
                (a, b) =>
                    b.cost > a.cost
                        ? b
                        : a
            );

        const mostUsed =
            appliances.reduce(
                (a, b) =>
                    b.count > a.count
                        ? b
                        : a
            );


        setValue(
            "aExp",
            expensive.name,
            inr(expensive.cost)
        );

        setValue(
            "aUsed",
            mostUsed.name,
            mostUsed.count +
                " records"
        );

    } else {

        setValue(
            "aExp",
            "-",
            ""
        );

        setValue(
            "aUsed",
            "-",
            ""
        );
    }


    /* ---------- TOTALS ---------- */

    countTo(
        $("aTotal"),
        total
    );

    countTo(
        $("aCost"),
        cost,
        2,
        "₹"
    );
}


/* =========================================================
   RENDER TABLE
   ========================================================= */

function renderTable() {

    let rows =
        filtered(true);


    /* ---------- SORT ---------- */

    rows.sort((a, b) => {

        const x =
            a[state.sortKey];

        const y =
            b[state.sortKey];


        if (
            typeof x === "number" &&
            typeof y === "number"
        ) {

            return (
                x - y
            ) * state.sortDir;
        }


        return String(x)
            .localeCompare(
                String(y)
            ) *
            state.sortDir;
    });


    /* ---------- PAGINATION ---------- */

    const pages =
        Math.max(
            1,
            Math.ceil(
                rows.length /
                PAGE_SIZE
            )
        );


    state.page =
        Math.min(
            state.page,
            pages
        );


    const start =
        (state.page - 1) *
        PAGE_SIZE;


    /* ---------- THRESHOLD ---------- */

    let threshold = 0;

    if (state.all.length > 0) {

        const average =
            sum(
                state.all,
                record =>
                    Number(
                        record.consumption
                    )
            ) /
            state.all.length;

        threshold =
            average * 1.25;
    }


    /* ---------- TABLE HTML ---------- */

    const visibleRows =
        rows.slice(
            start,
            start + PAGE_SIZE
        );


    $("tbody").innerHTML =
        visibleRows.length

            ? visibleRows
                .map(
                    (record, index) => {

                        const high =
                            Number(
                                record.consumption
                            ) >= threshold;

                        return `
                            <tr>
                                <td>
                                    ${start + index + 1}
                                </td>

                                <td>
                                    ${record.date}
                                </td>

                                <td>
                                    ${record.day}
                                </td>

                                <td>
                                    ${record.appliance}
                                </td>

                                <td class="${high ? "high" : ""}">
                                    ${Number(
                                        record.consumption
                                    ).toFixed(2)}
                                </td>

                                <td>
                                    ${inr(
                                        Number(
                                            record.cost
                                        )
                                    )}
                                </td>
                            </tr>
                        `;
                    }
                )
                .join("")

            : `
                <tr>
                    <td colspan="6">
                        No records match your filters.
                    </td>
                </tr>
            `;


    /* ---------- PAGE INFO ---------- */

    $("pageInfo").textContent =
        `Page ${state.page} of ${pages} (${rows.length} records)`;


    $("prev").disabled =
        state.page <= 1;

    $("next").disabled =
        state.page >= pages;
}


/* =========================================================
   MASTER REFRESH
   ========================================================= */

function refresh() {

    const rows =
        filtered();


    updateKpis(rows);

    updateCharts(rows);

    updateAnalytics(rows);

    renderTable();
}


/* =========================================================
   INITIALIZE DASHBOARD
   ========================================================= */

function init() {

    /* ---------- MONTH DROPDOWN ---------- */

    const months =
        [
            ...new Set(
                state.all.map(
                    record =>
                        monthKey(
                            record.date
                        )
                )
            )
        ]
        .sort();


    months.forEach(month => {

        $("monthSel")
            .insertAdjacentHTML(
                "beforeend",
                `
                <option value="${month}">
                    ${monthName(month)}
                </option>
                `
            );
    });


    /* ---------- APPLIANCE DROPDOWN ---------- */

    APPLIANCES.forEach(
        appliance => {

            $("appSel")
                .insertAdjacentHTML(
                    "beforeend",
                    `
                    <option value="${appliance}">
                        ${appliance}
                    </option>
                    `
                );
        }
    );


    /* ---------- BUILD CHARTS ---------- */

    try {

        buildCharts();

    } catch (error) {

        console.error(
            "Chart creation error:",
            error
        );

        $("error").hidden = false;

        $("error").innerHTML = `
            <b>Chart error occurred.</b>
            <br>
            ${error.message}
        `;

        return;
    }


    /* ---------- FIRST REFRESH ---------- */

    refresh();


    /* ---------- HIDE LOADER ---------- */

    $("loader").classList.add("done");


    /* =====================================================
       EVENT LISTENERS
       ===================================================== */


    /* ---------- MONTH ---------- */

    $("monthSel").onchange =
        event => {

            state.month =
                event.target.value;

            state.page = 1;

            refresh();
        };


    /* ---------- APPLIANCE ---------- */

    $("appSel").onchange =
        event => {

            state.app =
                event.target.value;

            state.page = 1;

            refresh();
        };


    /* ---------- SEARCH ---------- */

    $("search").oninput =
        event => {

            state.search =
                event.target.value;

            state.page = 1;

            renderTable();
        };


    /* ---------- PREVIOUS ---------- */

    $("prev").onclick =
        () => {

            if (state.page > 1) {

                state.page--;

                renderTable();
            }
        };


    /* ---------- NEXT ---------- */

    $("next").onclick =
        () => {

            state.page++;

            renderTable();
        };


    /* ---------- TABLE SORTING ---------- */

    document
        .querySelectorAll(
            "th[data-sort]"
        )
        .forEach(header => {

            header.onclick =
                () => {

                    const key =
                        header.dataset.sort;


                    if (
                        state.sortKey === key
                    ) {

                        state.sortDir =
                            -state.sortDir;

                    } else {

                        state.sortDir = 1;

                        state.sortKey =
                            key;
                    }


                    renderTable();
                };
        });
}


/* =========================================================
   THEME
   ========================================================= */

function applyTheme(theme) {

    document.documentElement
        .dataset.theme =
        theme;


    $("themeBtn").textContent =
        theme === "dark"
            ? "🌙"
            : "☀️";


    localStorage.setItem(
        "theme",
        theme
    );


    if (charts.line) {

        setupChartDefaults();

        Object.values(charts)
            .forEach(chart => {

                if (chart) {
                    chart.update();
                }
            });
    }
}


/* ---------- THEME BUTTON ---------- */

$("themeBtn").onclick =
    () => {

        const current =
            document.documentElement
                .dataset
                .theme;

        applyTheme(
            current === "dark"
                ? "light"
                : "dark"
        );
    };


/* ---------- LOAD SAVED THEME ---------- */

applyTheme(
    localStorage.getItem("theme") ||
    "dark"
);


/* =========================================================
   SIDEBAR / NAVIGATION
   ========================================================= */

const sidebar =
    $("sidebar");

const scrim =
    $("scrim");


function toggleMenu(open) {

    sidebar.classList.toggle(
        "open",
        open
    );

    scrim.classList.toggle(
        "show",
        open
    );
}


/* ---------- MENU BUTTON ---------- */

$("menuBtn").onclick =
    () => toggleMenu(true);


/* ---------- SCRIM ---------- */

scrim.onclick =
    () => toggleMenu(false);


/* ---------- SIDEBAR LINKS ---------- */

document
    .querySelectorAll(
        ".sidebar a"
    )
    .forEach(link => {

        link.onclick =
            event => {

                event.preventDefault();


                document
                    .querySelectorAll(
                        ".sidebar a"
                    )
                    .forEach(item =>
                        item.classList.remove(
                            "active"
                        )
                    );


                link.classList.add(
                    "active"
                );


                const section =
                    $(link.dataset.section);


                if (section) {

                    section.scrollIntoView({
                        behavior: "smooth"
                    });
                }


                toggleMenu(false);
            };
    });


/* =========================================================
   START APPLICATION
   ========================================================= */

loadData();