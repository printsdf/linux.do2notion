// ==UserScript==
// @name         Linux.do 帖子导出到 Notion
// @namespace    https://linux.do/
// @version      1.0.0
// @description  导出 Linux.do 帖子到 Notion（支持筛选、图片引用、丰富格式）
// @author       flobby
// @license      MIT
// @match        https://linux.do/t/*
// @match        https://linux.do/t/topic/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api.notion.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    // -----------------------
    // 存储 key
    // -----------------------
    const K = {
        // 筛选相关
        RANGE_MODE: "ld_notion_range_mode",
        RANGE_START: "ld_notion_range_start",
        RANGE_END: "ld_notion_range_end",
        FILTER_ONLY_FIRST: "ld_notion_filter_only_first",
        FILTER_ONLY_OP: "ld_notion_filter_only_op",
        FILTER_IMG: "ld_notion_filter_img",
        FILTER_USERS: "ld_notion_filter_users",
        FILTER_INCLUDE: "ld_notion_filter_include",
        FILTER_EXCLUDE: "ld_notion_filter_exclude",
        FILTER_MINLEN: "ld_notion_filter_minlen",
        // UI 状态
        PANEL_COLLAPSED: "ld_notion_panel_collapsed",
        ADVANCED_OPEN: "ld_notion_panel_advanced_open",
        PANEL_MINIMIZED: "ld_notion_panel_minimized",
        MINI_POS_X: "ld_notion_mini_pos_x",
        MINI_POS_Y: "ld_notion_mini_pos_y",
        // 完整面板位置
        PANEL_POS_X: "ld_notion_panel_pos_x",
        PANEL_POS_Y: "ld_notion_panel_pos_y",
        // Notion 配置
        NOTION_API_KEY: "ld_notion_api_key",
        NOTION_PAGE_ID: "ld_notion_page_id",
        NOTION_PANEL_OPEN: "ld_notion_panel_open",
        // 主题设置
        THEME_MODE: "ld_notion_theme_mode", // 'auto' | 'light' | 'dark'
    };

    const DEFAULTS = {
        rangeMode: "all",
        rangeStart: 1,
        rangeEnd: 999999,
        onlyFirst: false,
        onlyOp: false,
        imgFilter: "none",
        users: "",
        include: "",
        exclude: "",
        minLen: 0,
        notionApiKey: "",
        notionPageId: "",
    };

    // -----------------------
    // 主题配色方案
    // -----------------------
    const THEMES = {
        dark: {
            // 面板背景 - 匹配 Discourse 暗色主题（深蓝黑）
            panelBg: "#1e2225",
            panelBorder: "#3a3f44",
            panelShadow: "0 4px 20px rgba(0,0,0,0.4)",
            // 卡片/区块背景 - 稍亮的深色
            cardBg: "#252a2e",
            cardBorder: "#3a3f44",
            // 输入框 - 深色背景
            inputBg: "#1a1d21",
            inputBorder: "#3a3f44",
            // 文字颜色 - Discourse 风格灰白
            textPrimary: "#e4e6eb",
            textSecondary: "#c4c7c5",
            textMuted: "#9ca3af",
            textSubtle: "#6b7280",
            // 强调色 - Discourse 青蓝色
            accent: "#4eb1ba",
            accentLight: "#4eb1ba",
            // 状态色
            success: "#3aaf85",
            warning: "#f0ad4e",
            error: "#e74c3c",
            info: "#4eb1ba",
            // 按钮 - Discourse 风格
            btnPrimaryBg: "#0088cc",
            btnPrimaryText: "#ffffff",
            btnSecondaryBg: "#3a3f44",
            btnSecondaryText: "#c4c7c5",
            btnSuccessBg: "#3aaf85",
            // 分割线
            divider: "#3a3f44",
            // 进度条
            progressBg: "#3a3f44",
            progressFill: "#4eb1ba",
        },
        light: {
            // 面板背景 - 完全契合 Discourse 亮色主题
            panelBg: "#ffffff",
            panelBorder: "#e9e9e9",
            panelShadow: "none",
            // 卡片/区块背景 - Discourse 风格的浅灰背景
            cardBg: "#f8f8f8",
            cardBorder: "#e9e9e9",
            // 输入框 - Discourse 风格
            inputBg: "#ffffff",
            inputBorder: "#e9e9e9",
            // 文字颜色 - Discourse 亮色主题标准色
            textPrimary: "#222222",
            textSecondary: "#333333",
            textMuted: "#666666",
            textSubtle: "#919191",
            // 强调色 - Discourse 蓝色
            accent: "#0088cc",
            accentLight: "#0088cc",
            // 状态色
            success: "#009900",
            warning: "#e9a100",
            error: "#e45735",
            info: "#0088cc",
            // 按钮 - Discourse 风格
            btnPrimaryBg: "#0088cc",
            btnPrimaryText: "#ffffff",
            btnSecondaryBg: "#f2f2f2",
            btnSecondaryText: "#333333",
            btnSuccessBg: "#009900",
            // 分割线
            divider: "#e9e9e9",
            // 进度条
            progressBg: "#e9e9e9",
            progressFill: "#0088cc",
        },
    };

    // -----------------------
    // 主题管理器
    // -----------------------
    const themeManager = {
        currentTheme: "dark",
        observers: [],

        // 检测 Discourse 当前主题
        detectDiscourseTheme() {
            // Discourse 使用多种方式标记主题
            // 1. html 元素的 data-theme-* 属性
            const html = document.documentElement;
            const dataTheme = html.getAttribute("data-theme-name") || "";
            const dataColorScheme = html.getAttribute("data-color-scheme") || "";
            
            // 2. body 的 class
            const bodyClasses = document.body.className || "";
            
            // 3. 检查 CSS 变量或媒体查询
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            
            // 判断是否为亮色主题
            const isLight =
                dataColorScheme === "light" ||
                dataTheme.toLowerCase().includes("light") ||
                bodyClasses.includes("light-theme") ||
                (!dataColorScheme && !dataTheme.toLowerCase().includes("dark") && !prefersDark);
            
            return isLight ? "light" : "dark";
        },

        // 获取当前应该使用的主题
        getEffectiveTheme() {
            const mode = GM_getValue(K.THEME_MODE, "auto");
            if (mode === "auto") {
                return this.detectDiscourseTheme();
            }
            return mode;
        },

        // 应用主题到面板
        applyTheme(theme) {
            this.currentTheme = theme;
            const colors = THEMES[theme];
            const panel = document.querySelector("#ld-notion-panel");
            if (!panel) return;

            // 更新面板容器样式
            const panelContainer = panel.querySelector("#ld-panel-container");
            if (panelContainer) {
                panelContainer.style.background = colors.panelBg;
                panelContainer.style.borderColor = colors.panelBorder;
                panelContainer.style.boxShadow = colors.panelShadow;
                panelContainer.style.color = colors.textSecondary;
            }

            // 更新最小化标签样式
            const miniTab = panel.querySelector("#ld-mini-tab");
            if (miniTab) {
                miniTab.style.background = colors.panelBg;
                miniTab.style.borderColor = colors.panelBorder;
                miniTab.style.boxShadow = colors.panelShadow;
                miniTab.style.color = colors.textSecondary;
            }

            // 更新头部
            const header = panel.querySelector("#ld-header");
            if (header) {
                header.style.borderBottomColor = colors.divider;
                const titleSpan = header.querySelector("span[style*='font-weight']");
                if (titleSpan) {
                    titleSpan.style.color = colors.textPrimary;
                }
            }

            // 更新进度区域
            const progressCard = panel.querySelector("#ld-notion-body > div:first-child");
            if (progressCard) {
                progressCard.style.background = colors.cardBg;
                progressCard.style.borderColor = colors.cardBorder;
            }

            const progressBar = panel.querySelector("#ld-progress-bar");
            if (progressBar) {
                progressBar.style.background = colors.progressBg;
            }

            const progressFill = panel.querySelector("#ld-progress-fill");
            if (progressFill) {
                progressFill.style.background = colors.progressFill;
            }

            const progressText = panel.querySelector("#ld-progress-text");
            if (progressText) {
                progressText.style.color = colors.accentLight;
            }

            // 更新按钮
            const exportBtn = panel.querySelector("#ld-export-notion");
            if (exportBtn) {
                exportBtn.style.background = colors.btnPrimaryBg;
                exportBtn.style.color = colors.btnPrimaryText;
            }

            const openBtn = panel.querySelector("#ld-open-notion");
            if (openBtn) {
                openBtn.style.background = colors.btnSuccessBg;
            }

            const miniExportBtn = panel.querySelector("#ld-mini-export");
            if (miniExportBtn) {
                miniExportBtn.style.background = colors.btnPrimaryBg;
                miniExportBtn.style.color = colors.btnPrimaryText;
            }

            const miniExpandBtn = panel.querySelector("#ld-mini-expand");
            if (miniExpandBtn) {
                miniExpandBtn.style.background = colors.btnSecondaryBg;
                miniExpandBtn.style.color = colors.btnSecondaryText;
            }

            // 更新所有输入框
            panel.querySelectorAll("input, select").forEach((el) => {
                el.style.background = colors.inputBg;
                el.style.color = colors.textSecondary;
                el.style.borderColor = colors.inputBorder;
            });

            // 更新折叠按钮和文本
            panel.querySelectorAll("#ld-notion-config-toggle, #ld-advanced-toggle").forEach((el) => {
                el.style.borderTopColor = colors.divider;
                el.style.color = colors.textMuted;
            });

            // 更新分割线
            panel.querySelectorAll("div[style*='height:1px']").forEach((el) => {
                el.style.background = colors.divider;
            });

            // 更新标签文字
            panel.querySelectorAll("label").forEach((el) => {
                el.style.color = colors.textMuted;
            });

            // 更新小字说明
            panel.querySelectorAll("div[style*='font-size:10px'], div[style*='font-size:12px'][style*='font-weight:700']").forEach((el) => {
                if (el.style.fontWeight === "700") {
                    el.style.color = colors.textSecondary;
                } else {
                    el.style.color = colors.textSubtle;
                }
            });

            // 更新图标按钮颜色
            panel.querySelectorAll("#ld-minimize-btn, #ld-notion-toggle, #ld-notion-arrow, #ld-advanced-arrow").forEach((el) => {
                el.style.color = colors.textSubtle;
            });

            // 更新主题切换按钮状态
            this.updateThemeToggleButton(theme);
        },

        // 更新主题切换按钮显示
        updateThemeToggleButton(theme) {
            const btn = document.querySelector("#ld-theme-toggle");
            if (!btn) return;

            const mode = GM_getValue(K.THEME_MODE, "auto");
            let icon, title;

            if (mode === "auto") {
                icon = "◐";
                title = "自动跟随 Discourse（当前：" + (theme === "dark" ? "暗色" : "亮色") + "）";
            } else if (mode === "light") {
                icon = "☀";
                title = "亮色模式（点击切换）";
            } else {
                icon = "☾";
                title = "暗色模式（点击切换）";
            }

            btn.textContent = icon;
            btn.title = title;
        },

        // 切换主题模式
        cycleThemeMode() {
            const currentMode = GM_getValue(K.THEME_MODE, "auto");
            let nextMode;

            // 循环：auto -> light -> dark -> auto
            if (currentMode === "auto") {
                nextMode = "light";
            } else if (currentMode === "light") {
                nextMode = "dark";
            } else {
                nextMode = "auto";
            }

            GM_setValue(K.THEME_MODE, nextMode);
            const effectiveTheme = this.getEffectiveTheme();
            this.applyTheme(effectiveTheme);
        },

        // 监听 Discourse 主题变化
        startObserving() {
            // 监听 html 属性变化
            const htmlObserver = new MutationObserver(() => {
                const mode = GM_getValue(K.THEME_MODE, "auto");
                if (mode === "auto") {
                    const theme = this.getEffectiveTheme();
                    if (theme !== this.currentTheme) {
                        this.applyTheme(theme);
                    }
                }
            });

            htmlObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["data-theme-name", "data-color-scheme", "class"],
            });

            // 监听 body class 变化
            const bodyObserver = new MutationObserver(() => {
                const mode = GM_getValue(K.THEME_MODE, "auto");
                if (mode === "auto") {
                    const theme = this.getEffectiveTheme();
                    if (theme !== this.currentTheme) {
                        this.applyTheme(theme);
                    }
                }
            });

            bodyObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ["class"],
            });

            // 监听系统主题变化
            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
                const mode = GM_getValue(K.THEME_MODE, "auto");
                if (mode === "auto") {
                    const theme = this.getEffectiveTheme();
                    this.applyTheme(theme);
                }
            });

            this.observers.push(htmlObserver, bodyObserver);
        },

        // 初始化主题
        init() {
            const theme = this.getEffectiveTheme();
            this.applyTheme(theme);
            this.startObserving();
        },
    };

    // -----------------------
    // Emoji 名称到 Unicode 映射
    // -----------------------
    const EMOJI_MAP = {
        // 笑脸表情
        grinning_face: "😀", smiley: "😃", grinning_face_with_smiling_eyes: "😄", grin: "😁",
        laughing: "😆", sweat_smile: "😅", rofl: "🤣", joy: "😂",
        slightly_smiling_face: "🙂", upside_down_face: "🙃", melting_face: "🫠",
        wink: "😉", blush: "😊", innocent: "😇",
        smiling_face_with_three_hearts: "🥰", heart_eyes: "😍", star_struck: "🤩",
        face_blowing_a_kiss: "😘", kissing_face: "😗", smiling_face: "☺️",
        kissing_face_with_closed_eyes: "😚", kissing_face_with_smiling_eyes: "😙",
        smiling_face_with_tear: "🥲",
        // 舌头表情
        face_savoring_food: "😋", face_with_tongue: "😛", winking_face_with_tongue: "😜",
        zany_face: "🤪", squinting_face_with_tongue: "😝", money_mouth_face: "🤑",
        // 手势类表情
        hugs: "🤗", face_with_hand_over_mouth: "🤭", face_with_open_eyes_and_hand_over_mouth: "🫢",
        face_with_peeking_eye: "🫣", shushing_face: "🤫", thinking: "🤔", saluting_face: "🫡",
        // 嘴部表情
        zipper_mouth_face: "🤐", face_with_raised_eyebrow: "🤨", neutral_face: "😐",
        expressionless: "😑", expressionless_face: "😑", face_without_mouth: "😶",
        dotted_line_face: "🫥", face_in_clouds: "😶‍🌫️",
        // 斜眼表情
        smirk: "😏", smirking_face: "😏", unamused: "😒", unamused_face: "😒",
        roll_eyes: "🙄", rolling_eyes: "🙄", grimacing: "😬", face_exhaling: "😮‍💨",
        lying_face: "🤥", shaking_face: "🫨",
        head_shaking_horizontally: "🙂‍↔️", head_shaking_vertically: "🙂‍↕️",
        // 疲惫表情
        relieved: "😌", relieved_face: "😌", pensive: "😔", pensive_face: "😔",
        sleepy: "😪", sleepy_face: "😪", drooling_face: "🤤", sleeping: "😴", sleeping_face: "😴",
        face_with_bags_under_eyes: "🫩",
        // 生病表情
        mask: "😷", face_with_medical_mask: "😷", face_with_thermometer: "🤒",
        face_with_head_bandage: "🤕", nauseated_face: "🤢", face_vomiting: "🤮",
        sneezing_face: "🤧", hot_face: "🥵", cold_face: "🥶", woozy_face: "🥴",
        face_with_crossed_out_eyes: "😵", face_with_spiral_eyes: "😵‍💫", exploding_head: "🤯",
        // 帽子和眼镜表情
        cowboy_hat_face: "🤠", face_with_cowboy_hat: "🤠", partying_face: "🥳", disguised_face: "🥸",
        sunglasses: "😎", smiling_face_with_sunglasses: "😎", nerd_face: "🤓", face_with_monocle: "🧐",
        // 困惑表情
        confused: "😕", face_with_diagonal_mouth: "🫤", worried: "😟",
        slightly_frowning_face: "🙁", frowning: "☹️",
        // 惊讶表情
        open_mouth: "😮", hushed_face: "😯", astonished_face: "😲", flushed_face: "😳",
        distorted_face: "🫨", pleading_face: "🥺", face_holding_back_tears: "🥹",
        frowning_face_with_open_mouth: "😦", anguished_face: "😧",
        // 恐惧表情
        fearful: "😨", anxious_face_with_sweat: "😰", sad_but_relieved_face: "😥",
        cry: "😢", sob: "😭", scream: "😱",
        confounded: "😖", confounded_face: "😖", persevering_face: "😣",
        disappointed: "😞", disappointed_face: "😞", sweat: "😓", downcast_face_with_sweat: "😓",
        weary_face: "😩", tired_face: "😫", yawning_face: "🥱",
        // 愤怒表情
        face_with_steam_from_nose: "😤", enraged_face: "😡", angry: "😠", rage: "😡",
        face_with_symbols_on_mouth: "🤬",
        smiling_face_with_horns: "😈", angry_face_with_horns: "👿",
        // 骷髅和怪物
        skull: "💀", skull_and_crossbones: "☠️", poop: "💩", clown_face: "🤡",
        ogre: "👹", goblin: "👺", ghost: "👻", alien: "👽", alien_monster: "👾", robot: "🤖",
        // 猫咪表情
        grinning_cat: "😺", grinning_cat_with_smiling_eyes: "😸", joy_cat: "😹",
        smiling_cat_with_heart_eyes: "😻", cat_with_wry_smile: "😼", kissing_cat: "😽",
        weary_cat: "🙀", crying_cat: "😿", pouting_cat: "😾",
        // 三猴子
        see_no_evil_monkey: "🙈", hear_no_evil_monkey: "🙉", speak_no_evil_monkey: "🙊",
        // 心形类
        love_letter: "💌", heart_with_arrow: "💘", heart_with_ribbon: "💝",
        sparkling_heart: "💖", growing_heart: "💗", beating_heart: "💓",
        revolving_hearts: "💞", two_hearts: "💕", heart_decoration: "💟",
        heart_exclamation: "❣️", broken_heart: "💔", heart_on_fire: "❤️‍🔥", mending_heart: "❤️‍🩹",
        heart: "❤️", pink_heart: "🩷", orange_heart: "🧡", yellow_heart: "💛",
        green_heart: "💚", blue_heart: "💙", light_blue_heart: "🩵", purple_heart: "💜",
        brown_heart: "🤎", black_heart: "🖤", grey_heart: "🩶", white_heart: "🤍",
        // 符号类
        kiss_mark: "💋", "100": "💯", anger_symbol: "💢", fight_cloud: "💨",
        collision: "💥", dizzy: "💫", sweat_droplets: "💦", sweat_drops: "💦",
        dashing_away: "💨", dash: "💨", hole: "🕳️",
        speech_balloon: "💬", eye_in_speech_bubble: "👁️️🗨️", left_speech_bubble: "🗨️",
        right_anger_bubble: "🗯️", thought_balloon: "💭", zzz: "💤",
        // 兼容旧版本的别名
        smile: "😊", grinning: "😀", kissing: "😗", kissing_heart: "😘",
        stuck_out_tongue: "😛", heartpulse: "💗", heartbeat: "💓", cupid: "💘", gift_heart: "💝",
        // 手势
        thumbsup: "👍", thumbsdown: "👎", "+1": "👍", "-1": "👎",
        ok_hand: "👌", punch: "👊", fist: "✊", v: "✌️", wave: "👋",
        raised_hand: "✋", open_hands: "👐", muscle: "💪", pray: "🙏",
        point_up: "☝️", point_up_2: "👆", point_down: "👇", point_left: "👈", point_right: "👉",
        clap: "👏", raised_hands: "🙌", handshake: "🤝",
        // 通用符号
        star: "⭐", star2: "🌟", sparkles: "✨", zap: "⚡", fire: "🔥",
        boom: "💥", droplet: "💧",
        check: "✅", white_check_mark: "✅", x: "❌", cross_mark: "❌",
        heavy_check_mark: "✔️", heavy_multiplication_x: "✖️",
        question: "❓", exclamation: "❗", warning: "⚠️", no_entry: "⛔",
        triangular_flag: "🚩", triangular_flag_on_post: "🚩",
        sos: "🆘", ok: "🆗", cool: "🆒", new: "🆕", free: "🆓",
        // 动物
        dog: "🐕", cat: "🐈", mouse: "🐁", rabbit: "🐇", bear: "🐻",
        panda_face: "🐼", koala: "🐨", tiger: "🐯", lion: "🦁", cow: "🐄",
        pig: "🐷", monkey: "🐒", chicken: "🐔", penguin: "🐧", bird: "🐦",
        frog: "🐸", turtle: "🐢", snake: "🐍", dragon: "🐉", whale: "🐋",
        dolphin: "🐬", fish: "🐟", octopus: "🐙", bug: "🐛", bee: "🐝",
        // 食物
        apple: "🍎", green_apple: "🍏", banana: "🍌", orange: "🍊", lemon: "🍋",
        grapes: "🍇", watermelon: "🍉", strawberry: "🍓", peach: "🍑", cherries: "🍒",
        pizza: "🍕", hamburger: "🍔", fries: "🍟", hotdog: "🌭", taco: "🌮",
        coffee: "☕", tea: "🍵", beer: "🍺", wine_glass: "🍷", tropical_drink: "🍹",
        cake: "🍰", cookie: "🍪", chocolate_bar: "🍫", candy: "🍬", lollipop: "🍭",
        // 物品
        gift: "🎁", balloon: "🎈", tada: "🎉", confetti_ball: "🎊",
        trophy: "🏆", medal: "🏅", first_place_medal: "🥇", second_place_medal: "🥈", third_place_medal: "🥉",
        soccer: "⚽", basketball: "🏀", football: "🏈", tennis: "🎾", volleyball: "🏐",
        computer: "💻", keyboard: "⌨️", desktop_computer: "🖥️", printer: "🖨️", mouse_three_button: "🖱️",
        phone: "📱", telephone: "☎️", email: "📧", envelope: "✉️", memo: "📝",
        book: "📖", books: "📚", newspaper: "📰", bookmark: "🔖",
        bulb: "💡", flashlight: "🔦", candle: "🕯️",
        lock: "🔒", unlock: "🔓", key: "🔑",
        // 交通与天气
        rocket: "🚀", airplane: "✈️", car: "🚗", bus: "🚌", train: "🚆",
        sun: "☀️", cloud: "☁️", umbrella: "☂️", rainbow: "🌈", snowflake: "❄️",
        clock: "🕐", alarm_clock: "⏰", stopwatch: "⏱️", timer_clock: "⏲️",
        hourglass: "⌛", watch: "⌚",
        globe_showing_americas: "🌎", globe_showing_europe_africa: "🌍", globe_showing_asia_australia: "🌏",
        earth_americas: "🌎", earth_africa: "🌍", earth_asia: "🌏",
        bullseye: "🎯", dart: "🎯",
        // 国旗
        cn: "🇨🇳", us: "🇺🇸", jp: "🇯🇵", kr: "🇰🇷", gb: "🇬🇧",
    };

    // -----------------------
    // 工具函数
    // -----------------------
    function getTopicId() {
        const m =
            window.location.pathname.match(/\/topic\/(\d+)/) ||
            window.location.pathname.match(/\/t\/[^/]+\/(\d+)/);
        return m ? m[1] : null;
    }

    function absoluteUrl(src) {
        if (!src) return "";
        if (src.startsWith("http://") || src.startsWith("https://")) return src;
        if (src.startsWith("//")) return window.location.protocol + src;
        if (src.startsWith("/")) return window.location.origin + src;
        return window.location.origin + "/" + src.replace(/^\.?\//, "");
    }

    function clampInt(n, min, max, fallback) {
        const x = parseInt(String(n), 10);
        if (Number.isNaN(x)) return fallback;
        return Math.max(min, Math.min(max, x));
    }

    function normalizeListInput(s) {
        return (s || "")
            .split(/[\s,，;；]+/g)
            .map((x) => x.trim())
            .filter(Boolean);
    }

    function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }



    // -----------------------
    // Notion 支持的代码语言
    // -----------------------
    const NOTION_LANGUAGES = new Set([
        "abap", "abc", "agda", "arduino", "ascii art", "assembly", "bash", "basic", "bnf", "c", "c#", "c++",
        "clojure", "coffeescript", "coq", "css", "dart", "dhall", "diff", "docker", "ebnf", "elixir", "elm",
        "erlang", "flow", "fortran", "gherkin", "glsl", "go", "graphql", "groovy", "haskell", "hcl", "html",
        "idris", "java", "javascript", "json", "julia", "kotlin", "latex", "less", "lisp", "livescript",
        "llvm ir", "lua", "makefile", "markdown", "markup", "matlab", "mathematica", "mermaid", "nix",
        "notion formula", "objective-c", "ocaml", "pascal", "perl", "php", "plain text", "powershell",
        "prolog", "protobuf", "purescript", "python", "r", "racket", "reason", "ruby", "rust", "sass",
        "scala", "scheme", "scss", "shell", "smalltalk", "solidity", "sql", "swift", "toml", "typescript",
        "vb.net", "verilog", "vhdl", "visual basic", "webassembly", "xml", "yaml", "java/c/c++/c#"
    ]);

    function normalizeLanguage(lang) {
        if (!lang) return "plain text";

        const lower = lang.toLowerCase().trim();

        // 直接匹配
        if (NOTION_LANGUAGES.has(lower)) return lower;

        // 常见别名映射
        const aliases = {
            "auto": "plain text",
            "text": "plain text",
            "plaintext": "plain text",
            "js": "javascript",
            "ts": "typescript",
            "py": "python",
            "rb": "ruby",
            "sh": "shell",
            "yml": "yaml",
            "md": "markdown",
            "cpp": "c++",
            "csharp": "c#",
            "cs": "c#",
            "golang": "go",
            "rs": "rust",
            "kt": "kotlin",
            "jsx": "javascript",
            "tsx": "typescript",
            "vue": "html",
            "svelte": "html",
            "dockerfile": "docker",
            "makefile": "makefile",
            "cmake": "makefile",
            "bat": "powershell",
            "cmd": "powershell",
            "ps1": "powershell",
            "zsh": "shell",
            "fish": "shell",
            "asm": "assembly",
            "s": "assembly",
            "objc": "objective-c",
            "obj-c": "objective-c",
            "objective c": "objective-c",
            "vb": "visual basic",
            "vbnet": "vb.net",
            "tex": "latex",
            "ml": "ocaml",
            "fs": "f#",
            "fsharp": "f#",
            "ex": "elixir",
            "exs": "elixir",
            "erl": "erlang",
            "hs": "haskell",
            "jl": "julia",
            "nim": "plain text",
            "v": "verilog",
            "sv": "verilog",
            "vhd": "vhdl",
        };

        if (aliases[lower]) return aliases[lower];

        // 如果包含某些关键词
        if (lower.includes("script")) {
            if (lower.includes("java")) return "javascript";
            if (lower.includes("type")) return "typescript";
            if (lower.includes("coffee")) return "coffeescript";
            if (lower.includes("live")) return "livescript";
        }

        // 默认返回 plain text
        return "plain text";
    }

    // -----------------------
    // DOM -> Notion Blocks
    // -----------------------
    function cookedToNotionBlocks(cookedHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(cookedHtml || "", "text/html");
        const root = doc.body;

        const blocks = [];

        function serializeRichText(node) {
            const result = [];

            function processNode(n, annotations = {}) {
                if (!n) return;

                if (n.nodeType === Node.TEXT_NODE) {
                    let text = n.nodeValue || "";
                    // 清理多余的换行符和空白，但保留单个空格
                    text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ');
                    if (text && text.trim()) {
                        result.push({
                            type: "text",
                            text: { content: text },
                            annotations: { ...annotations },
                        });
                    }
                    return;
                }

                if (n.nodeType !== Node.ELEMENT_NODE) return;

                const el = n;
                const tag = el.tagName.toLowerCase();

                // 处理 emoji 图片
                if (tag === "img") {
                    const src = el.getAttribute("src") || el.getAttribute("data-src") || "";
                    const emojiMatch = src.match(/\/images\/emoji\/(?:twemoji|apple|google|twitter)\/([^/.]+)\.png/i);
                    if (emojiMatch) {
                        const emojiName = emojiMatch[1];
                        const emoji = EMOJI_MAP[emojiName] || el.getAttribute("alt") || el.getAttribute("title") || `:${emojiName}:`;
                        if (emoji) {
                            result.push({
                                type: "text",
                                text: { content: emoji },
                                annotations: { ...annotations },
                            });
                        }
                        return;
                    }
                    return;
                }

                // 处理链接
                if (tag === "a") {
                    const href = el.getAttribute("href") || "";
                    const classes = el.getAttribute("class") || "";
                    // 跳过 Discourse 的标题锚点链接
                    if (classes.includes("anchor") || href.startsWith("#")) {
                        Array.from(el.childNodes).forEach((c) => processNode(c, annotations));
                        return;
                    }
                    const hasImg = el.querySelector("img");
                    if (hasImg) {
                        Array.from(el.childNodes).forEach((c) => processNode(c, annotations));
                        return;
                    }
                    const link = absoluteUrl(href);
                    if (link) {
                        // 收集链接内的文本内容
                        const linkTexts = [];
                        const collectText = (node) => {
                            if (node.nodeType === Node.TEXT_NODE) {
                                linkTexts.push(node.nodeValue || "");
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                Array.from(node.childNodes).forEach(collectText);
                            }
                        };
                        Array.from(el.childNodes).forEach(collectText);
                        const linkText = linkTexts.join("");
                        if (linkText) {
                            result.push({
                                type: "text",
                                text: { content: linkText, link: { url: link } },
                                annotations: { ...annotations },
                            });
                        }
                    } else {
                        Array.from(el.childNodes).forEach((c) => processNode(c, annotations));
                    }
                    return;
                }

                // 处理格式标签
                if (tag === "strong" || tag === "b") {
                    Array.from(el.childNodes).forEach((c) => processNode(c, { ...annotations, bold: true }));
                    return;
                }
                if (tag === "em" || tag === "i") {
                    Array.from(el.childNodes).forEach((c) => processNode(c, { ...annotations, italic: true }));
                    return;
                }
                if (tag === "s" || tag === "del" || tag === "strike") {
                    Array.from(el.childNodes).forEach((c) => processNode(c, { ...annotations, strikethrough: true }));
                    return;
                }
                if (tag === "code") {
                    const text = el.textContent || "";
                    if (text) {
                        result.push({
                            type: "text",
                            text: { content: text },
                            annotations: { ...annotations, code: true },
                        });
                    }
                    return;
                }

                // 其他元素，递归处理子节点
                Array.from(el.childNodes).forEach((c) => processNode(c, annotations));
            }

            processNode(node);
            return result;
        }

        function processElement(el) {
            if (!el) return;
            if (el.nodeType !== Node.ELEMENT_NODE) return;

            const tag = el.tagName.toLowerCase();

            // 跳过 Discourse 的图片元信息容器
            if (el.classList && el.classList.contains('meta')) {
                return;
            }

            // 处理 Discourse 的表格容器
            if (el.classList && el.classList.contains('md-table')) {
                const table = el.querySelector("table");
                if (table) {
                    const result = processElementToBlock(table);
                    if (result) {
                        if (Array.isArray(result)) {
                            blocks.push(...result);
                        } else {
                            blocks.push(result);
                        }
                    }
                }
                return;
            }

            // 处理 Discourse 的 lightbox 图片容器
            if (el.classList && (el.classList.contains('lightbox-wrapper') || el.classList.contains('image-wrapper'))) {
                const img = el.querySelector("img");
                if (img) {
                    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
                    const full = absoluteUrl(src);
                    if (full) {
                        // 检测是否为 emoji 图片
                        const emojiMatch = src.match(/\/images\/emoji\/(?:twemoji|apple|google|twitter)\/([^/.]+)\.png/i);
                        if (!emojiMatch) {
                            blocks.push({
                                type: "image",
                                image: {
                                    type: "external",
                                    external: { url: full },
                                },
                            });
                        }
                    }
                }
                return;
            }

            // 处理 Discourse 引用块
            if (tag === "aside" && el.classList.contains("quote")) {
                const titleLink = el.querySelector(".quote-title__text-content a") || el.querySelector(".title > a");
                const title = titleLink?.textContent?.trim() || "引用";
                const href = titleLink?.getAttribute("href") || "";

                const blockquote = el.querySelector("blockquote");
                if (blockquote) {
                    const childBlocks = [];
                    Array.from(blockquote.children).forEach((child) => {
                        const childResult = processElementToBlock(child);
                        if (childResult) {
                            if (Array.isArray(childResult)) {
                                childBlocks.push(...childResult);
                            } else {
                                childBlocks.push(childResult);
                            }
                        }
                    });

                    // 构建标题的 rich_text，将链接改为可点击格式
                    const headerRichText = [];
                    headerRichText.push({ type: "text", text: { content: title } });
                    if (href) {
                        const fullUrl = absoluteUrl(href);
                        headerRichText.push({ type: "text", text: { content: " - " } });
                        headerRichText.push({ type: "text", text: { content: fullUrl, link: { url: fullUrl } } });
                    }

                    // 如果子块超过100个，需要分拆
                    if (childBlocks.length <= 100) {
                        blocks.push({
                            type: "quote",
                            quote: {
                                rich_text: headerRichText,
                                children: childBlocks,
                            },
                        });
                    } else {
                        // 分批处理，每批最多100个
                        for (let i = 0; i < childBlocks.length; i += 100) {
                            const chunk = childBlocks.slice(i, i + 100);
                            const richText = i === 0 ? headerRichText : [
                                ...headerRichText,
                                { type: "text", text: { content: ` (续${Math.floor(i/100)})` } }
                            ];
                            blocks.push({
                                type: "quote",
                                quote: {
                                    rich_text: richText,
                                    children: chunk,
                                },
                            });
                        }
                    }
                }
                return;
            }

            // 处理 Discourse onebox（链接预览）
            if (tag === "aside" && el.classList.contains("onebox")) {
                const titleEl = el.querySelector("h3 a") || el.querySelector("header a");
                const title = titleEl?.textContent?.trim() || "";
                const href = titleEl?.getAttribute("href") || "";
                const desc = el.querySelector("article p")?.textContent?.trim() || "";

                if (href) {
                    const link = absoluteUrl(href);
                    const content = desc ? `${title}\n${desc}` : title || link;
                    blocks.push({
                        type: "paragraph",
                        paragraph: {
                            rich_text: [{ type: "text", text: { content: content, link: { url: link } } }],
                        },
                    });
                }
                return;
            }

            const result = processElementToBlock(el);
            if (result) {
                if (Array.isArray(result)) {
                    blocks.push(...result);
                } else {
                    blocks.push(result);
                }
            }
        }

        function processElementToBlock(el) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;

            const tag = el.tagName.toLowerCase();

            // 段落
            if (tag === "p") {
                // 检查段落中是否有图片，如果有，需要分别处理
                const images = el.querySelectorAll("img");
                const hasImages = images.length > 0;

                if (hasImages) {
                    // 段落中有图片，需要拆分处理
                    const results = [];

                    // 先提取段落中的文本内容（不包括图片）
                    const textContent = [];
                    const collectTextNodes = (node) => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const text = node.nodeValue?.trim();
                            if (text) textContent.push(text);
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            const tag = node.tagName.toLowerCase();
                            if (tag !== "img") {
                                Array.from(node.childNodes).forEach(collectTextNodes);
                            }
                        }
                    };
                    Array.from(el.childNodes).forEach(collectTextNodes);

                    // 如果有文本内容，创建段落 block
                    if (textContent.length > 0) {
                        const richText = serializeRichText(el);
                        // 确保富文本有实际内容
                        const hasContent = richText.some(rt => {
                            const text = rt.text?.content || "";
                            return text.trim().length > 0;
                        });
                        if (hasContent) {
                            results.push({
                                type: "paragraph",
                                paragraph: { rich_text: richText },
                            });
                        }
                    }

                    // 为每个图片创建独立的 image block
                    images.forEach((img) => {
                        const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
                        const full = absoluteUrl(src);
                        if (!full) return;

                        // 检测是否为 emoji 图片
                        const emojiMatch = src.match(/\/images\/emoji\/(?:twemoji|apple|google|twitter)\/([^/.]+)\.png/i);
                        if (emojiMatch) return;

                        results.push({
                            type: "image",
                            image: {
                                type: "external",
                                external: { url: full },
                            },
                        });
                    });

                    return results.length > 0 ? results : null;
                }

                // 没有图片，正常处理段落
                const richText = serializeRichText(el);
                // 确保至少有一个非空的文本内容
                const hasContent = richText.some(rt => {
                    const text = rt.text?.content || "";
                    return text.trim().length > 0;
                });
                if (!hasContent) return null;
                return {
                    type: "paragraph",
                    paragraph: { rich_text: richText },
                };
            }

            // 代码块
            if (tag === "pre") {
                const codeEl = el.querySelector("code");
                const langClass = codeEl?.getAttribute("class") || "";
                const rawLang = (langClass.match(/lang(?:uage)?-([a-z0-9_+-]+)/i) || [])[1] || "plain text";
                const lang = normalizeLanguage(rawLang);
                const code = (codeEl ? codeEl.textContent : el.textContent) || "";
                return {
                    type: "code",
                    code: {
                        rich_text: [{ type: "text", text: { content: code } }],
                        language: lang,
                    },
                };
            }

            // 引用块（非 Discourse aside）
            if (tag === "blockquote") {
                const richText = serializeRichText(el);
                if (richText.length === 0) return null;
                return {
                    type: "quote",
                    quote: { rich_text: richText },
                };
            }

            // 标题
            if (/^h[1-3]$/.test(tag)) {
                const level = parseInt(tag.substring(1));
                const richText = serializeRichText(el);
                if (richText.length === 0) return null;
                return {
                    type: `heading_${level}`,
                    [`heading_${level}`]: { rich_text: richText },
                };
            }

            // 列表项
            if (tag === "ul") {
                const items = [];
                Array.from(el.children).forEach((li) => {
                    if (li.tagName.toLowerCase() === "li") {
                        const richText = serializeRichText(li);
                        // 检查是否有实际内容（不只是空白）
                        if (richText && richText.length > 0) {
                            const hasRealContent = richText.some(rt => {
                                const text = rt.text?.content || "";
                                return text.trim().length > 0;
                            });
                            if (hasRealContent) {
                                items.push({
                                    type: "bulleted_list_item",
                                    bulleted_list_item: { rich_text: richText },
                                });
                            }
                        }
                    }
                });
                return items.length > 0 ? items : null;
            }

            if (tag === "ol") {
                const items = [];
                Array.from(el.children).forEach((li) => {
                    if (li.tagName.toLowerCase() === "li") {
                        const richText = serializeRichText(li);
                        // 检查是否有实际内容（不只是空白）
                        if (richText && richText.length > 0) {
                            const hasRealContent = richText.some(rt => {
                                const text = rt.text?.content || "";
                                return text.trim().length > 0;
                            });
                            if (hasRealContent) {
                                items.push({
                                    type: "numbered_list_item",
                                    numbered_list_item: { rich_text: richText },
                                });
                            }
                        }
                    }
                });
                return items.length > 0 ? items : null;
            }

            // 表格
            if (tag === "table") {
                const rows = [];
                let hasHeader = false;

                // 处理表头
                const thead = el.querySelector("thead");
                if (thead) {
                    hasHeader = true;
                    const headerRows = thead.querySelectorAll("tr");
                    headerRows.forEach((tr) => {
                        const cells = [];
                        const ths = tr.querySelectorAll("th, td");
                        ths.forEach((th) => {
                            const richText = serializeRichText(th);
                            cells.push(richText.length > 0 ? richText : [{ type: "text", text: { content: "" } }]);
                        });
                        if (cells.length > 0) {
                            rows.push({ cells });
                        }
                    });
                }

                // 处理表体
                const tbody = el.querySelector("tbody");
                const bodyRows = tbody ? tbody.querySelectorAll("tr") : el.querySelectorAll("tr");
                bodyRows.forEach((tr) => {
                    const cells = [];
                    const tds = tr.querySelectorAll("td, th");
                    tds.forEach((td) => {
                        const richText = serializeRichText(td);
                        cells.push(richText.length > 0 ? richText : [{ type: "text", text: { content: "" } }]);
                    });
                    if (cells.length > 0) {
                        rows.push({ cells });
                    }
                });

                if (rows.length === 0) return null;

                // 计算表格宽度（列数）
                const tableWidth = Math.max(...rows.map(r => r.cells.length));

                // 构建 Notion 表格 block
                const tableBlock = {
                    type: "table",
                    table: {
                        table_width: tableWidth,
                        has_column_header: hasHeader,
                        has_row_header: false,
                        children: rows.map(row => ({
                            type: "table_row",
                            table_row: {
                                cells: row.cells
                            }
                        }))
                    }
                };

                return tableBlock;
            }

            // 图片
            if (tag === "img") {
                const src = el.getAttribute("src") || el.getAttribute("data-src") || "";
                const full = absoluteUrl(src);
                if (!full) return null;

                // 检测是否为 emoji 图片
                const emojiMatch = src.match(/\/images\/emoji\/(?:twemoji|apple|google|twitter)\/([^/.]+)\.png/i);
                if (emojiMatch) {
                    return null; // emoji 已在 rich text 中处理
                }

                return {
                    type: "image",
                    image: {
                        type: "external",
                        external: { url: full },
                    },
                };
            }

            return null;
        }

        // 处理根节点的所有子元素
        Array.from(root.children).forEach(processElement);

        // 额外处理：查找所有 lightbox-wrapper（可能被 DOMParser 重新组织）
        const lightboxWrappers = root.querySelectorAll(".lightbox-wrapper");
        lightboxWrappers.forEach((wrapper) => {
            const img = wrapper.querySelector("img");
            if (img) {
                const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
                const full = absoluteUrl(src);
                if (full) {
                    // 检测是否为 emoji 图片
                    const emojiMatch = src.match(/\/images\/emoji\/(?:twemoji|apple|google|twitter)\/([^/.]+)\.png/i);
                    if (!emojiMatch) {
                        // 检查是否已经添加过这个图片
                        const alreadyAdded = blocks.some(b =>
                            b.type === "image" && b.image?.external?.url === full
                        );
                        if (!alreadyAdded) {
                            blocks.push({
                                type: "image",
                                image: {
                                    type: "external",
                                    external: { url: full },
                                },
                            });
                        }
                    }
                }
            }
        });

        return blocks;
    }

    // -----------------------
    // 生成楼层 Callout Block
    // -----------------------
    function generatePostCalloutBlock(post, topic) {
        const isOp = (post.username || "").toLowerCase() === (topic.opUsername || "").toLowerCase();
        const dateStr = post.created_at ? new Date(post.created_at).toLocaleString("zh-CN") : "";

        const emoji = isOp ? "🏠" : "💬";
        const opBadge = isOp ? " 楼主" : "";

        let title = `#${post.post_number} ${post.name || post.username || "匿名"}`;
        if (post.name && post.username && post.name !== post.username) {
            title += ` (@${post.username})`;
        }
        title += opBadge;
        if (dateStr) title += ` · ${dateStr}`;

        const contentBlocks = cookedToNotionBlocks(post.cooked);

        // 如果有回复,添加回复信息
        const children = [];
        if (post.reply_to_post_number) {
            children.push({
                type: "paragraph",
                paragraph: {
                    rich_text: [
                        { type: "text", text: { content: `↩️ 回复 #${post.reply_to_post_number}楼` } }
                    ],
                },
            });
        }

        children.push(...contentBlocks);

        // Notion 限制每个 block 最多 100 个子 block
        // 如果内容超过100个块，需要返回多个块
        const result = [];
        
        if (children.length <= 100) {
            // 内容不超过100个块，直接返回一个 callout
            result.push({
                type: "callout",
                callout: {
                    icon: { type: "emoji", emoji },
                    rich_text: [{ type: "text", text: { content: title } }],
                    children: children,
                },
            });
        } else {
            // 内容超过100个块，需要分拆
            // 使用多个 callout，保持格式一致
            for (let i = 0; i < children.length; i += 100) {
                const chunk = children.slice(i, i + 100);
                const partNumber = Math.floor(i / 100) + 1;
                const totalParts = Math.ceil(children.length / 100);
                const titleText = i === 0 ? title : `${title} (${partNumber}/${totalParts})`;
                
                result.push({
                    type: "callout",
                    callout: {
                        icon: { type: "emoji", emoji },
                        rich_text: [{ type: "text", text: { content: titleText } }],
                        children: chunk,
                    },
                });
            }
        }

        return result;
    }

    // -----------------------
    // Notion API
    // -----------------------
    function createNotionPage(title, blocks, apiKey, parentPageId) {
        return new Promise((resolve, reject) => {
            const initialBlocks = blocks.slice(0, 100);
            const remainingBlocks = blocks.slice(100);

            const requestData = {
                parent: {
                    type: "page_id",
                    page_id: parentPageId,
                },
                properties: {
                    title: {
                        title: [{ text: { content: title } }],
                    },
                },
                children: initialBlocks,
            };

            GM_xmlhttpRequest({
                method: "POST",
                url: "https://api.notion.com/v1/pages",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "Notion-Version": "2022-06-28",
                },
                data: JSON.stringify(requestData),
                onload: async (response) => {
                    try {
                        if (response.status === 200) {
                            const data = JSON.parse(response.responseText);
                            const pageId = data.id;

                            // 如果有剩余 blocks，分批追加
                            if (remainingBlocks.length > 0) {
                                await appendBlocksToPage(pageId, remainingBlocks, apiKey);
                            }

                            resolve(data);
                        } else {
                            reject(new Error(`创建页面失败: ${response.status} ${response.statusText}\n${response.responseText}`));
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: (error) => {
                    reject(new Error(`网络请求失败: ${error}`));
                },
            });
        });
    }

    function appendBlocksToPage(pageId, blocks, apiKey) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            for (let i = 0; i < blocks.length; i += 100) {
                chunks.push(blocks.slice(i, i + 100));
            }

            let completed = 0;

            const appendChunk = (chunk) => {
                return new Promise((res, rej) => {
                    GM_xmlhttpRequest({
                        method: "PATCH",
                        url: `https://api.notion.com/v1/blocks/${pageId}/children`,
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                            "Notion-Version": "2022-06-28",
                        },
                        data: JSON.stringify({ children: chunk }),
                        onload: (response) => {
                            if (response.status === 200) {
                                completed++;
                                ui.setStatus(`追加内容中 (${completed}/${chunks.length})`, "#a855f7");
                                res();
                            } else {
                                rej(new Error(`追加 blocks 失败: ${response.status} ${response.statusText}`));
                            }
                        },
                        onerror: (error) => rej(new Error(`网络请求失败: ${error}`)),
                    });
                });
            };

            // 顺序追加所有 chunks
            (async () => {
                try {
                    for (const chunk of chunks) {
                        await appendChunk(chunk);
                        await sleep(300); // 避免速率限制
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            })();
        });
    }

    // -----------------------
    // 网络请求
    // -----------------------
    async function fetchJson(url, opts, retries = 2) {
        let lastErr = null;
        for (let i = 0; i <= retries; i++) {
            try {
                const res = await fetch(url, opts);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (e) {
                lastErr = e;
                if (i < retries) await sleep(250 * (i + 1));
            }
        }
        throw lastErr || new Error("fetchJson failed");
    }

    function getRequestOpts() {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
        const headers = { "x-requested-with": "XMLHttpRequest" };
        if (csrf) headers["x-csrf-token"] = csrf;
        return { headers };
    }

    // -----------------------
    // 拉取所有帖子
    // -----------------------
    async function fetchAllPostsDetailed(topicId) {
        const opts = getRequestOpts();

        const idData = await fetchJson(
            `${window.location.origin}/t/${topicId}/post_ids.json?post_number=0&limit=99999`,
            opts
        );
        let postIds = idData.post_ids || [];

        const mainData = await fetchJson(`${window.location.origin}/t/${topicId}.json`, opts);
        const mainFirstPost = mainData.post_stream?.posts?.[0];
        if (mainFirstPost && !postIds.includes(mainFirstPost.id)) postIds.unshift(mainFirstPost.id);

        const opUsername =
            mainData?.details?.created_by?.username ||
            mainData?.post_stream?.posts?.[0]?.username ||
            "";

        const domCategory = document.querySelector(".badge-category__name")?.textContent?.trim() || "";
        const domTags = Array.from(document.querySelectorAll(".discourse-tag"))
            .map((t) => t.textContent.trim())
            .filter(Boolean);

        const topic = {
            topicId: String(topicId || ""),
            title: mainData?.title ? String(mainData.title) : document.title,
            category: domCategory,
            tags: (Array.isArray(mainData?.tags) && mainData.tags.length ? mainData.tags : domTags) || [],
            url: window.location.href,
            opUsername: opUsername || "",
        };

        let allPosts = [];
        for (let i = 0; i < postIds.length; i += 200) {
            const chunk = postIds.slice(i, i + 200);
            const q = chunk.map((id) => `post_ids[]=${encodeURIComponent(id)}`).join("&");
            const data = await fetchJson(
                `${window.location.origin}/t/${topicId}/posts.json?${q}&include_suggested=false`,
                opts
            );
            const posts = data.post_stream?.posts || [];
            allPosts = allPosts.concat(posts);
            ui.setProgress(Math.min(i + 200, postIds.length), postIds.length, "拉取帖子数据");
        }

        allPosts.sort((a, b) => a.post_number - b.post_number);
        return { topic, posts: allPosts };
    }

    // -----------------------
    // 筛选
    // -----------------------
    function postHasImageFast(post) {
        const cooked = post?.cooked || "";
        return cooked.includes("<img");
    }

    function buildPlainCache(posts) {
        const cache = new Map();
        for (const p of posts) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(p.cooked || "", "text/html");
            const text = doc.body.textContent || "";
            cache.set(p.id, text);
        }
        return cache;
    }

    function applyFilters(topic, posts, settings) {
        const { rangeMode, rangeStart, rangeEnd, onlyFirst, filters } = settings;
        const op = (topic.opUsername || "").toLowerCase();

        const wantUsers = new Set(normalizeListInput(filters.users).map((u) => u.toLowerCase()));
        const includeKws = normalizeListInput(filters.include);
        const excludeKws = normalizeListInput(filters.exclude);
        const minLen = clampInt(filters.minLen, 0, 999999, 0);

        const needTextCheck = includeKws.length > 0 || excludeKws.length > 0 || minLen > 0;
        const plainCache = needTextCheck ? buildPlainCache(posts) : null;

        const inRange = (n) => {
            if (rangeMode !== "range") return true;
            return n >= rangeStart && n <= rangeEnd;
        };

        const matchKeywords = (txt, kws) => {
            if (!kws.length) return true;
            const low = txt.toLowerCase();
            return kws.some((k) => low.includes(k.toLowerCase()));
        };

        const hitExclude = (txt, kws) => {
            if (!kws.length) return false;
            const low = txt.toLowerCase();
            return kws.some((k) => low.includes(k.toLowerCase()));
        };

        const selected = [];
        for (const p of posts) {
            const pn = p.post_number || 0;

            // 如果启用了"只导出主题（1楼）"，则只保留第1楼
            if (onlyFirst && pn !== 1) continue;

            if (!inRange(pn)) continue;

            if (filters.onlyOp && op) {
                if ((p.username || "").toLowerCase() !== op) continue;
            }

            if (wantUsers.size) {
                if (!wantUsers.has((p.username || "").toLowerCase())) continue;
            }

            // 图片筛选
            if (filters.imgFilter === "withImg") {
                if (!postHasImageFast(p)) continue;
            } else if (filters.imgFilter === "noImg") {
                if (postHasImageFast(p)) continue;
            }

            if (needTextCheck) {
                const txt = plainCache.get(p.id) || "";
                if (minLen > 0 && txt.replace(/\s+/g, "").length < minLen) continue;
                if (!matchKeywords(txt, includeKws)) continue;
                if (hitExclude(txt, excludeKws)) continue;
            }

            selected.push(p);
        }

        return { selected, opUsername: topic.opUsername || "" };
    }

    function buildFilterSummary(settings, topic) {
        const { rangeMode, rangeStart, rangeEnd, onlyFirst, filters } = settings;
        const parts = [];
        if (onlyFirst) {
            parts.push("只导出主题（1楼）");
        } else {
            parts.push(rangeMode === "range" ? `范围=${rangeStart}-${rangeEnd}` : "范围=全部");
        }
        if (filters.onlyOp) parts.push(`只楼主=@${topic.opUsername || "OP"}`);
        if (filters.imgFilter === "withImg") parts.push("仅含图");
        if (filters.imgFilter === "noImg") parts.push("仅无图");
        if ((filters.users || "").trim()) parts.push(`用户=${filters.users.trim()}`);
        if ((filters.include || "").trim()) parts.push(`包含=${filters.include.trim()}`);
        if ((filters.exclude || "").trim()) parts.push(`排除=${filters.exclude.trim()}`);
        if ((filters.minLen || 0) > 0) parts.push(`最短=${filters.minLen}`);
        return parts.join("；");
    }

    // -----------------------
    // Panel UI
    // -----------------------
    const ui = {
        container: null,
        progressBar: null,
        progressText: null,
        statusText: null,
        btnNotion: null,
        btnOpenNotion: null,

        selRangeMode: null,
        inputRangeStart: null,
        inputRangeEnd: null,

        chkOnlyOp: null,
        selImgFilter: null,
        inputUsers: null,
        inputInclude: null,
        inputExclude: null,
        inputMinLen: null,

        advancedWrap: null,
        notionWrap: null,

        inputNotionApiKey: null,

        init() {
            if (this.container) return;

            const wrap = document.createElement("div");
            wrap.id = "ld-notion-panel";
            wrap.innerHTML = `
<!-- 最小化标签 -->
<div id="ld-mini-tab" style="
  position:fixed;z-index:99999;
  background:#1e2225;
  border:1px solid #3a3f44;border-radius:6px;
  box-shadow:0 4px 20px rgba(0,0,0,0.4);
  padding:8px 12px;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;
  font-size:13px;color:#c4c7c5;user-select:none;
  cursor:move;
  display:none;
  min-width:130px;
">
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="font-size:14px;color:#4eb1ba;">◆</span>
    <button id="ld-mini-export" style="
      flex:1;border:none;border-radius:4px;padding:6px 10px;
      font-size:12px;font-weight:600;cursor:pointer;
      background:#0088cc;color:#fff;
      transition:all 0.15s ease;
    ">导出</button>
    <button id="ld-mini-expand" style="
      border:none;border-radius:4px;padding:6px 8px;
      font-size:12px;font-weight:500;cursor:pointer;
      background:#3a3f44;color:#c4c7c5;
      transition:all 0.15s ease;
    ">展开</button>
  </div>
  <div id="ld-mini-status" style="display:none;margin-top:6px;font-size:11px;color:#3aaf85;word-break:break-all;text-align:center;"></div>
</div>

<!-- 完整面板 -->
<div id="ld-panel-container" style="
  position:fixed;bottom:16px;right:16px;z-index:99999;
  width:300px;max-height:85vh;overflow-y:auto;overflow-x:hidden;
  background:#1e2225;
  border:1px solid #3a3f44;border-radius:6px;
  box-shadow:0 4px 20px rgba(0,0,0,0.4);
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;
  font-size:13px;color:#c4c7c5;user-select:none;">

  <div id="ld-header" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px;border-bottom:1px solid #3a3f44;cursor:move;">
    <span id="ld-header-title" style="font-weight:700;font-size:13px;color:#e4e6eb;display:flex;align-items:center;gap:6px;">
      <span style="color:#4eb1ba;">◆</span> Notion 导出
    </span>
    <div style="display:flex;align-items:center;gap:6px;">
      <span id="ld-theme-toggle" style="color:#6b7280;font-size:13px;cursor:pointer;padding:2px;" title="切换主题">◐</span>
      <span id="ld-minimize-btn" style="color:#6b7280;font-size:14px;cursor:pointer;padding:2px;" title="最小化">−</span>
      <span id="ld-notion-toggle" style="color:#6b7280;font-size:12px;cursor:pointer;padding:2px;">▾</span>
    </div>
  </div>

  <div id="ld-notion-body" style="padding:10px 12px 12px;">
    <div id="ld-progress-card" style="background:#252a2e;border:1px solid #3a3f44;border-radius:4px;padding:8px 10px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <div id="ld-progress-bar" style="flex:1;height:5px;border-radius:3px;background:#3a3f44;overflow:hidden;">
          <div id="ld-progress-fill" style="width:0%;height:100%;background:#4eb1ba;transition:width .2s;"></div>
        </div>
        <span id="ld-progress-text" style="min-width:55px;text-align:right;font-size:11px;color:#4eb1ba;">准备就绪</span>
      </div>
      <div id="ld-status" style="margin-top:4px;font-size:11px;color:#3aaf85;word-break:break-all;"></div>
    </div>

    <button id="ld-open-notion" style="
      width:100%;margin-bottom:8px;display:none;
      border:none;border-radius:4px;padding:9px 12px;
      font-size:13px;font-weight:600;cursor:pointer;color:white;
      background:#3aaf85;
      transition:all 0.15s ease;
    ">🔗 打开 Notion 页面</button>

    <button id="ld-export-notion" style="
      width:100%;margin-bottom:8px;
      border:none;border-radius:4px;padding:9px 12px;
      font-size:13px;font-weight:600;cursor:pointer;color:white;
      background:#0088cc;
      transition:all 0.15s ease;
    ">导出到 Notion</button>

    <div id="ld-notion-config-toggle" style="
      display:flex;align-items:center;justify-content:space-between;
      padding:7px 0;cursor:pointer;font-size:12px;color:#9ca3af;
      border-top:1px solid #3a3f44;margin-top:4px;
    "><span>▸ Notion 连接设置</span><span id="ld-notion-arrow" style="font-size:10px;">▾</span></div>

    <div id="ld-notion-wrap" style="display:none;padding-top:8px;">
      <input id="ld-notion-api-key" type="password" placeholder="Notion API Key" style="width:100%;box-sizing:border-box;margin-bottom:6px;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:7px 9px;font-size:12px;outline:none;" />
      <input id="ld-notion-page-id" type="text" placeholder="父页面 ID（32位字符串）" style="width:100%;box-sizing:border-box;margin-bottom:6px;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:7px 9px;font-size:12px;outline:none;" />
      <div style="color:#6b7280;font-size:10px;line-height:1.4;">
        1. <a href="https://www.notion.so/my-integrations" target="_blank" style="color:#4eb1ba;">创建 Integration</a><br/>
        2. 添加 Integration 到父页面<br/>
        3. 复制页面 URL 中的 ID
      </div>
    </div>

    <div id="ld-advanced-toggle" style="
      display:flex;align-items:center;justify-content:space-between;
      padding:7px 0;cursor:pointer;font-size:12px;color:#9ca3af;
      border-top:1px solid #3a3f44;margin-top:4px;
    "><span>▸ 高级筛选</span><span id="ld-advanced-arrow" style="font-size:10px;">▾</span></div>

    <div id="ld-advanced-wrap" style="display:none;padding-top:8px;">
      <div style="font-size:12px;font-weight:600;color:#c4c7c5;margin-bottom:6px;">楼层范围</div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
        <select id="ld-range-mode" style="background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:5px 8px;font-size:12px;outline:none;">
          <option value="all">全部楼层</option>
          <option value="range">指定范围</option>
        </select>
        <input id="ld-range-start" type="number" placeholder="起始" style="width:55px;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:5px 7px;font-size:12px;outline:none;" />
        <span style="color:#6b7280;">-</span>
        <input id="ld-range-end" type="number" placeholder="结束" style="width:55px;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:5px 7px;font-size:12px;outline:none;" />
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:4px;color:#9ca3af;font-size:12px;">
          <input id="ld-only-first" type="checkbox" style="accent-color:#4eb1ba;" /> 只导出主题（1楼）
        </label>
      </div>

      <div style="height:1px;background:#3a3f44;margin:10px 0;"></div>

      <div style="font-size:12px;font-weight:600;color:#c4c7c5;margin-bottom:6px;">筛选条件</div>
      <div style="display:flex;gap:12px;margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:4px;color:#9ca3af;font-size:12px;">
          <input id="ld-only-op" type="checkbox" style="accent-color:#4eb1ba;" /> 只看楼主
        </label>
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
        <span style="color:#9ca3af;font-size:12px;white-space:nowrap;">图片筛选：</span>
        <select id="ld-img-filter" style="flex:1;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:5px 8px;font-size:12px;outline:none;">
          <option value="none">无（不筛选）</option>
          <option value="withImg">仅含图楼层</option>
          <option value="noImg">仅无图楼层</option>
        </select>
      </div>
      <input id="ld-users" type="text" placeholder="指定用户（逗号分隔）" style="width:100%;box-sizing:border-box;margin-bottom:6px;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:7px 9px;font-size:12px;outline:none;" />
      <input id="ld-include" type="text" placeholder="包含关键词（逗号分隔）" style="width:100%;box-sizing:border-box;margin-bottom:6px;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:7px 9px;font-size:12px;outline:none;" />
      <input id="ld-exclude" type="text" placeholder="排除关键词（逗号分隔）" style="width:100%;box-sizing:border-box;margin-bottom:6px;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:7px 9px;font-size:12px;outline:none;" />
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
        <span style="color:#9ca3af;font-size:12px;">最少字数：</span>
        <input id="ld-minlen" type="number" placeholder="0" style="width:70px;background:#1a1d21;color:#c4c7c5;border:1px solid #3a3f44;border-radius:4px;padding:5px 7px;font-size:12px;outline:none;" />
      </div>
    </div>
  </div>
</div>`;
            document.body.appendChild(wrap);
            this.container = wrap;

            const panelContainer = wrap.querySelector("#ld-panel-container");
            const miniTab = wrap.querySelector("#ld-mini-tab");

            // 恢复最小化状态
            const isMinimized = GM_getValue(K.PANEL_MINIMIZED, false);

            // 恢复或设置最小化标签位置
            const savedMiniX = GM_getValue(K.MINI_POS_X, null);
            const savedMiniY = GM_getValue(K.MINI_POS_Y, null);

            if (savedMiniX !== null && savedMiniY !== null) {
                miniTab.style.left = savedMiniX + "px";
                miniTab.style.top = savedMiniY + "px";
            } else {
                // 默认位置：右侧中间
                miniTab.style.right = "16px";
                miniTab.style.top = "50%";
                miniTab.style.transform = "translateY(-50%)";
            }

            // 根据状态显示对应的UI
            if (isMinimized) {
                panelContainer.style.display = "none";
                miniTab.style.display = "block";
            } else {
                panelContainer.style.display = "block";
                miniTab.style.display = "none";
            }

            // 最小化标签拖拽功能
            let isMiniDragging = false;
            let startX = 0;
            let startY = 0;
            let initialX = 0;
            let initialY = 0;

            miniTab.addEventListener("mousedown", (e) => {
                // 不在按钮上时才触发拖拽
                if (e.target.id === "ld-mini-export" || e.target.id === "ld-mini-expand") return;

                isMiniDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = miniTab.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;

                // 移除 right/bottom/transform 定位，改用 left/top
                miniTab.style.right = "auto";
                miniTab.style.bottom = "auto";
                miniTab.style.transform = "none";
                miniTab.style.left = initialX + "px";
                miniTab.style.top = initialY + "px";

                e.preventDefault();
            });

            document.addEventListener("mousemove", (e) => {
                if (!isMiniDragging) return;

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                let newX = initialX + deltaX;
                let newY = initialY + deltaY;

                // 边界限制
                const maxX = window.innerWidth - miniTab.offsetWidth;
                const maxY = window.innerHeight - miniTab.offsetHeight;

                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));

                miniTab.style.left = newX + "px";
                miniTab.style.top = newY + "px";
            });

            document.addEventListener("mouseup", () => {
                if (isMiniDragging) {
                    isMiniDragging = false;

                    // 保存位置
                    const rect = miniTab.getBoundingClientRect();
                    GM_setValue(K.MINI_POS_X, rect.left);
                    GM_setValue(K.MINI_POS_Y, rect.top);
                }
            });

            // 完整面板拖动功能
            let isPanelDragging = false;
            let panelStartX = 0;
            let panelStartY = 0;
            let panelInitialX = 0;
            let panelInitialY = 0;

            const header = panelContainer.querySelector("#ld-header");

            // 恢复面板位置
            const savedPanelX = GM_getValue(K.PANEL_POS_X, null);
            const savedPanelY = GM_getValue(K.PANEL_POS_Y, null);

            if (savedPanelX !== null && savedPanelY !== null) {
                panelContainer.style.right = "auto";
                panelContainer.style.bottom = "auto";
                panelContainer.style.left = savedPanelX + "px";
                panelContainer.style.top = savedPanelY + "px";
            }

            header.addEventListener("mousedown", (e) => {
                // 不在按钮上时才触发拖拽
                if (e.target.id === "ld-minimize-btn" ||
                    e.target.id === "ld-notion-toggle" ||
                    e.target.id === "ld-theme-toggle") return;

                isPanelDragging = true;
                panelStartX = e.clientX;
                panelStartY = e.clientY;

                const rect = panelContainer.getBoundingClientRect();
                panelInitialX = rect.left;
                panelInitialY = rect.top;

                // 移除 right/bottom 定位，改用 left/top
                panelContainer.style.right = "auto";
                panelContainer.style.bottom = "auto";
                panelContainer.style.left = panelInitialX + "px";
                panelContainer.style.top = panelInitialY + "px";

                e.preventDefault();
            });

            document.addEventListener("mousemove", (e) => {
                if (!isPanelDragging) return;

                const deltaX = e.clientX - panelStartX;
                const deltaY = e.clientY - panelStartY;

                let newX = panelInitialX + deltaX;
                let newY = panelInitialY + deltaY;

                // 边界限制
                const maxX = window.innerWidth - panelContainer.offsetWidth;
                const maxY = window.innerHeight - panelContainer.offsetHeight;

                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));

                panelContainer.style.left = newX + "px";
                panelContainer.style.top = newY + "px";
            });

            document.addEventListener("mouseup", () => {
                if (isPanelDragging) {
                    isPanelDragging = false;

                    // 保存位置
                    const rect = panelContainer.getBoundingClientRect();
                    GM_setValue(K.PANEL_POS_X, rect.left);
                    GM_setValue(K.PANEL_POS_Y, rect.top);
                }
            });

            // 最小化/展开切换
            const minimizeBtn = wrap.querySelector("#ld-minimize-btn");
            const expandBtn = wrap.querySelector("#ld-mini-expand");

            minimizeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                panelContainer.style.display = "none";
                miniTab.style.display = "block";
                GM_setValue(K.PANEL_MINIMIZED, true);
            });

            expandBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                miniTab.style.display = "none";
                panelContainer.style.display = "block";
                GM_setValue(K.PANEL_MINIMIZED, false);
            });

            this.progressBar = wrap.querySelector("#ld-progress-fill");
            this.progressText = wrap.querySelector("#ld-progress-text");
            this.statusText = wrap.querySelector("#ld-status");
            this.btnNotion = wrap.querySelector("#ld-export-notion");
            this.btnOpenNotion = wrap.querySelector("#ld-open-notion");

            this.selRangeMode = wrap.querySelector("#ld-range-mode");
            this.inputRangeStart = wrap.querySelector("#ld-range-start");
            this.inputRangeEnd = wrap.querySelector("#ld-range-end");
            this.chkOnlyFirst = wrap.querySelector("#ld-only-first");

            this.chkOnlyOp = wrap.querySelector("#ld-only-op");
            this.selImgFilter = wrap.querySelector("#ld-img-filter");
            this.inputUsers = wrap.querySelector("#ld-users");
            this.inputInclude = wrap.querySelector("#ld-include");
            this.inputExclude = wrap.querySelector("#ld-exclude");
            this.inputMinLen = wrap.querySelector("#ld-minlen");

            this.advancedWrap = wrap.querySelector("#ld-advanced-wrap");
            this.notionWrap = wrap.querySelector("#ld-notion-wrap");

            this.inputNotionApiKey = wrap.querySelector("#ld-notion-api-key");
            this.inputNotionPageId = wrap.querySelector("#ld-notion-page-id");

            // 恢复状态
            const rangeMode = GM_getValue(K.RANGE_MODE, DEFAULTS.rangeMode);
            const rangeStart = GM_getValue(K.RANGE_START, DEFAULTS.rangeStart);
            const rangeEnd = GM_getValue(K.RANGE_END, DEFAULTS.rangeEnd);
            const onlyFirst = GM_getValue(K.FILTER_ONLY_FIRST, DEFAULTS.onlyFirst);
            const onlyOp = GM_getValue(K.FILTER_ONLY_OP, DEFAULTS.onlyOp);
            const imgFilter = GM_getValue(K.FILTER_IMG, DEFAULTS.imgFilter);
            const users = GM_getValue(K.FILTER_USERS, DEFAULTS.users);
            const include = GM_getValue(K.FILTER_INCLUDE, DEFAULTS.include);
            const exclude = GM_getValue(K.FILTER_EXCLUDE, DEFAULTS.exclude);
            const minLen = GM_getValue(K.FILTER_MINLEN, DEFAULTS.minLen);
            const notionApiKey = GM_getValue(K.NOTION_API_KEY, DEFAULTS.notionApiKey);
            const notionPageId = GM_getValue(K.NOTION_PAGE_ID, DEFAULTS.notionPageId);

            this.selRangeMode.value = rangeMode;
            this.inputRangeStart.value = String(rangeStart);
            this.inputRangeEnd.value = String(rangeEnd);
            this.chkOnlyFirst.checked = !!onlyFirst;
            this.chkOnlyOp.checked = !!onlyOp;
            this.selImgFilter.value = imgFilter || DEFAULTS.imgFilter;
            this.inputUsers.value = users || "";
            this.inputInclude.value = include || "";
            this.inputExclude.value = exclude || "";
            this.inputMinLen.value = String(minLen || 0);
            this.inputNotionApiKey.value = notionApiKey || "";
            this.inputNotionPageId.value = notionPageId || "";

            // 面板折叠
            const toggleIcon = wrap.querySelector("#ld-notion-toggle");
            const bodyDiv = wrap.querySelector("#ld-notion-body");
            const collapsed = GM_getValue(K.PANEL_COLLAPSED, false);
            if (collapsed) {
                bodyDiv.style.display = "none";
                toggleIcon.textContent = "▴";
            }

            // 只在点击折叠按钮时触发折叠
            toggleIcon.addEventListener("click", (e) => {
                e.stopPropagation();
                const isHidden = bodyDiv.style.display === "none";
                bodyDiv.style.display = isHidden ? "" : "none";
                toggleIcon.textContent = isHidden ? "▾" : "▴";
                GM_setValue(K.PANEL_COLLAPSED, !isHidden);
            });

            // Notion 设置面板展开
            const notionBtn = wrap.querySelector("#ld-notion-config-toggle");
            const notionArrow = wrap.querySelector("#ld-notion-arrow");
            const notionPanelOpen = GM_getValue(K.NOTION_PANEL_OPEN, false);
            const notionApiKeyEmpty = !GM_getValue(K.NOTION_API_KEY, "");
            if (notionApiKeyEmpty || notionPanelOpen) {
                this.notionWrap.style.display = "";
                notionArrow.textContent = "▴";
            }
            notionBtn.addEventListener("click", () => {
                const open = this.notionWrap.style.display !== "none";
                this.notionWrap.style.display = open ? "none" : "";
                notionArrow.textContent = open ? "▾" : "▴";
                GM_setValue(K.NOTION_PANEL_OPEN, !open);
            });

            // 高级设置展开
            const advBtn = wrap.querySelector("#ld-advanced-toggle");
            const advArrow = wrap.querySelector("#ld-advanced-arrow");
            const advOpen = GM_getValue(K.ADVANCED_OPEN, false);
            if (advOpen) {
                this.advancedWrap.style.display = "";
                advArrow.textContent = "▴";
            }
            advBtn.addEventListener("click", () => {
                const open = this.advancedWrap.style.display !== "none";
                this.advancedWrap.style.display = open ? "none" : "";
                advArrow.textContent = open ? "▾" : "▴";
                GM_setValue(K.ADVANCED_OPEN, !open);
            });

            // 保存配置事件
            const saveRange = () => {
                const mode = this.selRangeMode.value === "range" ? "range" : "all";
                const start = clampInt(this.inputRangeStart.value, 1, 999999, DEFAULTS.rangeStart);
                const end = clampInt(this.inputRangeEnd.value, 1, 999999, DEFAULTS.rangeEnd);
                const onlyFirst = !!this.chkOnlyFirst.checked;
                GM_setValue(K.RANGE_MODE, mode);
                GM_setValue(K.RANGE_START, start);
                GM_setValue(K.RANGE_END, end);
                GM_setValue(K.FILTER_ONLY_FIRST, onlyFirst);
                const disabled = mode !== "range";
                this.inputRangeStart.disabled = disabled;
                this.inputRangeEnd.disabled = disabled;
                this.inputRangeStart.style.opacity = disabled ? "0.55" : "1";
                this.inputRangeEnd.style.opacity = disabled ? "0.55" : "1";
            };
            this.selRangeMode.addEventListener("change", saveRange);
            this.inputRangeStart.addEventListener("change", saveRange);
            this.inputRangeEnd.addEventListener("change", saveRange);
            this.chkOnlyFirst.addEventListener("change", saveRange);
            saveRange();

            const saveFilters = () => {
                GM_setValue(K.FILTER_ONLY_OP, !!this.chkOnlyOp.checked);
                GM_setValue(K.FILTER_IMG, this.selImgFilter.value || "none");
                GM_setValue(K.FILTER_USERS, this.inputUsers.value || "");
                GM_setValue(K.FILTER_INCLUDE, this.inputInclude.value || "");
                GM_setValue(K.FILTER_EXCLUDE, this.inputExclude.value || "");
                GM_setValue(K.FILTER_MINLEN, clampInt(this.inputMinLen.value, 0, 999999, 0));
            };
            [this.chkOnlyOp].forEach((el) => el.addEventListener("change", saveFilters));
            [this.selImgFilter].forEach((el) => el.addEventListener("change", saveFilters));
            [this.inputUsers, this.inputInclude, this.inputExclude, this.inputMinLen].forEach((el) => el.addEventListener("change", saveFilters));

            // Notion 配置保存
            this.inputNotionApiKey.addEventListener("change", () => GM_setValue(K.NOTION_API_KEY, this.inputNotionApiKey.value || ""));
            this.inputNotionPageId.addEventListener("change", () => GM_setValue(K.NOTION_PAGE_ID, this.inputNotionPageId.value || ""));

            // 主题切换按钮事件
            const themeToggleBtn = wrap.querySelector("#ld-theme-toggle");
            if (themeToggleBtn) {
                themeToggleBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    themeManager.cycleThemeMode();
                });
            }

            this.setProgress(0, 1, "准备就绪");
            this.setStatus("", "#6ee7b7");
            this.setBusy(false);

            // 初始化主题
            themeManager.init();
        },

        getSettings() {
            const rangeMode = this.selRangeMode.value === "range" ? "range" : "all";
            const rangeStart = clampInt(this.inputRangeStart.value, 1, 999999, DEFAULTS.rangeStart);
            const rangeEnd = clampInt(this.inputRangeEnd.value, 1, 999999, DEFAULTS.rangeEnd);
            const onlyFirst = !!this.chkOnlyFirst.checked;

            const onlyOp = !!this.chkOnlyOp.checked;
            const imgFilter = this.selImgFilter.value || DEFAULTS.imgFilter;
            const users = this.inputUsers.value || "";
            const include = this.inputInclude.value || "";
            const exclude = this.inputExclude.value || "";
            const minLen = clampInt(this.inputMinLen.value, 0, 999999, 0);

            const notionApiKey = this.inputNotionApiKey.value || "";
            const notionPageId = this.inputNotionPageId.value || "";

            return {
                rangeMode,
                rangeStart,
                rangeEnd,
                onlyFirst,
                filters: { onlyOp, imgFilter, users, include, exclude, minLen },
                notion: { apiKey: notionApiKey, pageId: notionPageId },
            };
        },

        setProgress(completed, total, stageText) {
            if (!this.container) this.init();
            total = total || 1;
            const percent = Math.round((completed / total) * 100);
            this.progressBar.style.width = percent + "%";
            this.progressText.textContent = `${stageText} (${completed}/${total}，${percent}%)`;
        },

        setStatus(msg, color) {
            if (!this.container) this.init();
            this.statusText.textContent = msg;
            this.statusText.style.color = color || "#6ee7b7";
        },

        // 设置小界面状态显示
        setMiniStatus(msg, color, autoHide = false) {
            if (!this.container) this.init();
            const miniStatus = this.container.querySelector("#ld-mini-status");
            if (!miniStatus) return;

            if (msg) {
                miniStatus.textContent = msg;
                miniStatus.style.color = color || "#3aaf85";
                miniStatus.style.display = "block";

                // 自动隐藏（可选）
                if (autoHide) {
                    setTimeout(() => {
                        miniStatus.style.display = "none";
                    }, 5000);
                }
            } else {
                miniStatus.style.display = "none";
            }
        },

        setBusy(busy) {
            if (!this.container) this.init();
            this.btnNotion.disabled = busy;
            this.btnNotion.style.opacity = busy ? "0.6" : "1";

            // 同时设置小界面导出按钮状态
            const miniExportBtn = this.container.querySelector("#ld-mini-export");
            if (miniExportBtn) {
                miniExportBtn.disabled = busy;
                miniExportBtn.style.opacity = busy ? "0.6" : "1";
            }
        },
    };

    // -----------------------
    // 导出主流程
    // -----------------------
    async function exportToNotion() {
        const topicId = getTopicId();
        if (!topicId) return alert("未检测到帖子 ID");

        ui.init();

        // 检查当前是否为最小化状态
        const isMinimized = GM_getValue(K.PANEL_MINIMIZED, false);

        ui.setBusy(true);
        ui.setStatus("正在拉取帖子内容…", "#6366f1");
        ui.setProgress(0, 1, "准备中");

        // 如果是最小化状态，在小界面显示状态
        if (isMinimized) {
            ui.setMiniStatus("导出中...", "#6366f1");
        }

        try {
            const settings = ui.getSettings();

            if (!settings.notion.apiKey) {
                // 需要配置时，展开大面板
                const panelContainer = document.querySelector("#ld-panel-container");
                const miniTab = document.querySelector("#ld-mini-tab");
                if (isMinimized) {
                    miniTab.style.display = "none";
                    panelContainer.style.display = "block";
                    GM_setValue(K.PANEL_MINIMIZED, false);
                    ui.setMiniStatus(""); // 清除小界面状态
                }

                ui.notionWrap.style.display = "";
                ui.container.querySelector("#ld-notion-arrow").textContent = "▴";
                GM_setValue(K.NOTION_PANEL_OPEN, true);

                ui.setStatus("⚠️ 请先配置 Notion API Key", "#facc15");
                ui.setBusy(false);
                return;
            }

            if (!settings.notion.pageId) {
                // 需要配置时，展开大面板
                const panelContainer = document.querySelector("#ld-panel-container");
                const miniTab = document.querySelector("#ld-mini-tab");
                if (isMinimized) {
                    miniTab.style.display = "none";
                    panelContainer.style.display = "block";
                    GM_setValue(K.PANEL_MINIMIZED, false);
                    ui.setMiniStatus(""); // 清除小界面状态
                }

                ui.notionWrap.style.display = "";
                ui.container.querySelector("#ld-notion-arrow").textContent = "▴";
                GM_setValue(K.NOTION_PANEL_OPEN, true);

                ui.setStatus("⚠️ 请先配置 Notion 父页面 ID", "#facc15");
                ui.setBusy(false);
                return;
            }

            const data = await fetchAllPostsDetailed(topicId);

            if (settings.rangeMode === "range" && settings.rangeStart > settings.rangeEnd) {
                ui.setStatus("⚠️ 起始楼层不能大于结束楼层", "#facc15");
                if (isMinimized) {
                    ui.setMiniStatus("⚠️ 范围错误", "#facc15", true);
                }
                ui.setBusy(false);
                return;
            }

            const { selected } = applyFilters(data.topic, data.posts, settings);

            if (!selected.length) {
                ui.setStatus("筛选后无可导出的楼层", "#facc15");
                if (isMinimized) {
                    ui.setMiniStatus("⚠️ 无可导出楼层", "#facc15", true);
                }
                ui.setBusy(false);
                return;
            }

            ui.setStatus("正在转换为 Notion 格式…", "#6366f1");
            if (isMinimized) {
                ui.setMiniStatus(`转换中 (${selected.length}楼)...`, "#6366f1");
            }

            // 构建页面内容
            const blocks = [];

            // 添加帖子信息 callout
            const now = new Date();
            const filterSummary = buildFilterSummary(settings, data.topic);

            // 构建信息块的子内容
            const infoChildren = [];

            // 原始链接 - 使用超链接格式
            infoChildren.push({
                type: "paragraph",
                paragraph: {
                    rich_text: [
                        { type: "text", text: { content: "原始链接: " } },
                        { type: "text", text: { content: data.topic.url, link: { url: data.topic.url } } }
                    ],
                },
            });

            // 其他信息 - 纯文本
            const otherInfo = [
                `主题 ID: ${data.topic.topicId}`,
                `楼主: @${data.topic.opUsername || "未知"}`,
                `分类: ${data.topic.category || "无"}`,
                `标签: ${data.topic.tags.join(", ")}`,
                `导出时间: ${now.toLocaleString("zh-CN")}`,
                `楼层数: ${selected.length}`,
            ];
            if (filterSummary) {
                otherInfo.push(`筛选条件: ${filterSummary}`);
            }

            otherInfo.forEach(line => {
                infoChildren.push({
                    type: "paragraph",
                    paragraph: {
                        rich_text: [{ type: "text", text: { content: line } }],
                    },
                });
            });

            blocks.push({
                type: "callout",
                callout: {
                    icon: { type: "emoji", emoji: "ℹ️" },
                    rich_text: [{ type: "text", text: { content: "帖子信息" } }],
                    children: infoChildren,
                },
            });

            // 添加分隔线
            blocks.push({
                type: "divider",
                divider: {},
            });

            // 添加所有楼层
            ui.setStatus("正在生成楼层内容…", "#6366f1");
            let processedCount = 0;
            for (const post of selected) {
                const postBlocks = generatePostCalloutBlock(post, data.topic);
                // postBlocks 现在可能是数组（长内容被拆分）
                if (Array.isArray(postBlocks)) {
                    blocks.push(...postBlocks);
                } else {
                    blocks.push(postBlocks);
                }
                processedCount++;
                if (processedCount % 10 === 0) {
                    ui.setProgress(processedCount, selected.length, "生成楼层");
                }
            }

            ui.setStatus("正在创建 Notion 页面…", "#6366f1");
            if (isMinimized) {
                ui.setMiniStatus("创建页面中...", "#6366f1");
            }

            const pageData = await createNotionPage(data.topic.title, blocks, settings.notion.apiKey, settings.notion.pageId);

            ui.setProgress(1, 1, "导出完成");
            ui.setStatus(`✅ 已导出到 Notion`, "#6ee7b7");

            // 如果是最小化状态，在小界面显示成功状态
            if (isMinimized) {
                ui.setMiniStatus("✅ 导出成功!", "#3aaf85");
                // 5秒后询问是否打开
                setTimeout(() => {
                    if (confirm("导出成功！是否打开 Notion 页面？")) {
                        window.open(pageData.url, "_blank");
                    }
                }, 500);
            } else {
                // 大面板模式，显示打开 Notion 按钮
                ui.btnOpenNotion.style.display = "";
                ui.btnOpenNotion.onclick = () => {
                    window.open(pageData.url, "_blank");
                };

                // 500ms后询问是否打开页面
                setTimeout(() => {
                    if (confirm("导出成功！是否打开 Notion 页面？")) {
                        window.open(pageData.url, "_blank");
                    }
                }, 500);
            }
        } catch (e) {
            console.error(e);
            ui.setStatus("导出失败：" + (e?.message || e), "#fecaca");
            if (isMinimized) {
                ui.setMiniStatus("❌ 导出失败", "#fecaca", true);
            }
            alert("Notion 导出失败：" + (e?.message || e));
        } finally {
            ui.setBusy(false);
        }
    }

    // -----------------------
    // 入口
    // -----------------------
    function init() {
        const topicId = getTopicId();
        if (!topicId) {
            console.log("[LinuxDo Notion Export] 未检测到帖子 ID，脚本不加载");
            return;
        }

        console.log("[LinuxDo Notion Export] 初始化脚本，帖子 ID:", topicId);

        ui.init();
        ui.btnNotion.addEventListener("click", exportToNotion);

        // 最小化标签的快速导出按钮
        const miniExportBtn = document.querySelector("#ld-mini-export");
        if (miniExportBtn) {
            miniExportBtn.addEventListener("click", exportToNotion);
        }

        console.log("[LinuxDo Notion Export] 初始化完成");
    }

    // 由于使用 @run-at document-idle，页面可能已经加载完成
    // 需要检查页面状态并适当调用 init
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // 页面已加载，直接初始化
        setTimeout(init, 100); // 略微延迟确保 DOM 完全就绪
    } else {
        // 页面还在加载，监听 load 事件
        window.addEventListener("load", init);
    }
})();
