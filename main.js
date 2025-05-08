'use strict';

var obsidian = require('obsidian');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */


/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
    return extendStatics(d, b);
};
function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

const DEFAULT_SETTINGS = {
    // Zen Mode stuff
    animationDuration: 2,          // How fast things fade in, umm, in seconds.
    showHeader: false,             // Show the header in Zen? Nah.
    showScroll: false,             // Scrollbars? Who needs 'em.
    showGraphControls: false,      // Graph controls begone!
    forceReadable: true,           // Make text readable, like, centered.
    // Standard from prozen
    vignetteOpacity: 0.75,
    vignetteScaleLinear: 20,
    vignetteScaleRadial: 75,

    zenModePresentation: "simulated", // "simulated" Less drama or "native" Slow fullscreen vim Mode Nahhh.

    // Cross-Platform Focus Mode - the UI hider!
    enableCrossPlatformFocus: true,
    crossPlatformTriggerClicks: 3, // Clicky clicky to toggle. 0 = off.

    clickActionTarget: "crossPlatformFocus", // What happens when you go clicky clicky.

    /* 
    Todo: all shortened names haven't i learned enough 😭

    CP = CrossPlatform
    ms = millisec
    JAPPA = bail
    ANM = Active Note Mode
    */

    // Desktop bits to hide for CP Focus
    cpHideLeftRibbon: true,
    cpHideRightRibbon: true,
    cpHideLeftSidebar: true,
    cpHideRightSidebar: true,
    cpHideStatusBar: true,
    cpHideTopTabContainer: true,

    // Mobile bits to hide for CP Focus
    cpMobileHideNavbar: true,
    cpMobileHideViewHeader: true,    // This one do be a bit finicky on mobile.
    cpMobileHideTabHeaderInner: true,
    cpMobileHideTabHeaderContainerTablet: true,

    debugMode: false,              // For when things go pear-shaped and I need logs.
};

// Dat end's the tutorial no more over comments

/*
 * --- MAIN PLUGIN LOGIC ---
 * This is where all the magic happens for fullscreening and UI hiding.
 * Handles Zen mode (active leaf fullscreen) and Cross-Platform Focus (general UI hiding).
 */
var FullScreenPlugin = /** @class */ (function (_super) {
    __extends(FullScreenPlugin, _super);
    function FullScreenPlugin() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.settings = DEFAULT_SETTINGS;
        _this.isZenModeActive = false;
        _this.activeLeafWhenZenModeStarted = null;
        _this.activeZenPresentation = null;
        _this.nativeFullscreenChangeHandler = null;
        _this.isCrossPlatformFocusActive = false;
        _this.crossPlatformClickListener = null;
        _this._boundCrossPlatformClickHandler = null; // make sure this clicky clicky starts fresh
        _this.clickListenerState = { lastClickTime: 0, clickCount: 0 };
        return _this;
    }

    FullScreenPlugin.prototype.onload = async function () {
        console.log("Full Screen Toggle V2: Plugin loading.");
        await this.loadSettings();

        this.addCommand({
            id: "zen-mode-toggle",
            name: "Toggle Zen mode (Active Leaf)",
            callback: this.toggleZenMode.bind(this),
        });

        this.addCommand({
            id: "cross-platform-focus-toggle",
            name: "Toggle Cross-Platform Focus (UI Hiding)",
            checkCallback: (checking) => { // Only add command if CP Focus is enabled.
                if (this.settings.enableCrossPlatformFocus) {
                    if (!checking) {
                        this.toggleCrossPlatformFocusMode();
                    }
                    return true;
                }
                return false;
            }
        });
        
        this.updateCrossPlatformClickListener(); // Set up the clicky/tap listener based on settings.

        this.addSettingTab(new ZenModeSettingTab(this.app, this));
        console.log("Full Screen Toggle V2: Plugin loaded.");
    };

    FullScreenPlugin.prototype.onunload = function () {
        console.log("Full Screen Toggle V2: Plugin unloading.");
        if (this.isZenModeActive) {
            this.exitZenMode(); // Clean up Zen mode if it's active.
        }
        if (this.isCrossPlatformFocusActive) {
            this.deactivateCrossPlatformFocusMode(); 
        }
        this.removeCrossPlatformClickListener();
        this.resetCssVariables(); // And reset any CSS vars from b4.
        console.log("Full Screen Toggle V2: Plugin unloaded.");
    };

    FullScreenPlugin.prototype.loadSettings = async function () {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    };

    FullScreenPlugin.prototype.saveSettings = async function () {
        await this.saveData(this.settings);
        this.setCssVariables(); 
        this.updateCrossPlatformClickListener(); // Todo: Change the click listener

        // If Zen mode is active, re-apply styles for new settings. Kinda like a refresh.
        if (this.isZenModeActive && this.activeLeafWhenZenModeStarted) {
            this.removeStyles(this.activeLeafWhenZenModeStarted);
            this.addStyles(this.activeLeafWhenZenModeStarted);
        }
        // Same for CP Focus, update body classes.
        if (this.isCrossPlatformFocusActive) {
            this.updateCrossPlatformBodyClasses();
        }
    };

    /* --- CSS VARIABLE UTILS --- */
    FullScreenPlugin.prototype.setCssVariables = function () {
        // Pokes CSS variables into the :root for styles to use.
        const root = document.documentElement;
        root.style.setProperty('--fadeIn-duration', this.settings.animationDuration + 's');
        root.style.setProperty('--vignette-opacity', String(this.settings.vignetteOpacity));
        root.style.setProperty('--vignette-scale-linear', this.settings.vignetteScaleLinear + '%');
        root.style.setProperty('--vignette-scale-radial', this.settings.vignetteScaleRadial + '%');
    };

    FullScreenPlugin.prototype.resetCssVariables = function () {
        // Clean up our CSS variables.
        const root = document.documentElement;
        root.style.removeProperty('--fadeIn-duration');
        root.style.removeProperty('--vignette-opacity');
        root.style.removeProperty('--vignette-scale-linear');
        root.style.removeProperty('--vignette-scale-radial');
    };

    /*
     * --- ZEN MODE CORE ---
     * Handles entering/exiting Zen mode, which fullscreen-ifies the active leaf.
     */
    FullScreenPlugin.prototype.toggleZenMode = function () {
        if (this.isZenModeActive) {
            this.exitZenMode();
        } else {
            const leaf = this.app.workspace.getActiveViewOfType(obsidian.ItemView)?.leaf;
            if (!leaf) { // No active leaf? No Zen for you. dammn! 🤣
                new obsidian.Notice("No active view to enter Zen mode.");
                return;
            }
            if (leaf.view.getViewType() === "empty") { // Empty view? Also no Zen... for you 👀
                new obsidian.Notice("Cannot enter Zen mode on an empty view.");
                return;
            }
            this.enterZenMode(leaf);
        }
    };
    
    FullScreenPlugin.prototype.enterZenMode = function (leaf) {
        if (this.isZenModeActive) return;
        if (this.isCrossPlatformFocusActive) { // F*** You!!! No conflict
            this.deactivateCrossPlatformFocusMode();
        }

        this.activeLeafWhenZenModeStarted = leaf;
        this.setCssVariables();

        if (this.settings.zenModePresentation === "native") {
            this.enterNativeFullscreen(leaf);
        } else {
            this.enterSimulatedFullscreen(leaf); // Default, CSS-based.
        }
    };

    FullScreenPlugin.prototype.exitZenMode = function () {
        if (!this.isZenModeActive) return;

        if (this.activeZenPresentation === "native") {
            this.exitNativeFullscreen();
        } else if (this.activeZenPresentation === "simulated") {
            this.exitSimulatedFullscreen();
        }
        /* activeLeafWhenZenModeStarted and activeZenPresentation are nulled in exit sub-functions */
    };

    /* --- ZEN MODE: SIMULATED FULLSCREEN --- */
    FullScreenPlugin.prototype.enterSimulatedFullscreen = function (leaf) {
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: ENTERING SIMULATED. Current plugin state this.isZenModeActive:", this.isZenModeActive);
        if (!leaf) {
            if (this.settings.debugMode) console.log("Full Screen Toggle V2: ENTER SIMULATED - Aborting, no leaf provided.");
            return;
        }
        this.activeZenPresentation = 'simulated';
        const leafEl = this.activeLeafWhenZenModeStarted.view.containerEl.closest('.workspace-leaf');

        if (!leafEl) { 
            console.error("Full Screen Toggle V2: ENTER SIMULATED - Could not find .workspace-leaf for the active view.", leaf);
            new obsidian.Notice("Error entering Zen mode. See console.");
            this.cleanupSimulatedFullscreenOnError();
            return;
        }
        
        document.body.classList.add('obsidian-zen-mode-simulated-active'); // Body class triggers global style changes.
        leafEl.classList.add('zen-mode-active-leaf'); // Target this leaf specifically.
        this.addStyles(this.activeLeafWhenZenModeStarted); // Apply Zen styles (vignette, etc.)
        this.isZenModeActive = true;
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: ENTER SIMULATED - Successfully entered.");
        new obsidian.Notice("Zen mode (Simulated) activated", 1500);
    };

    FullScreenPlugin.prototype.exitSimulatedFullscreen = function () {
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: EXITING SIMULATED.");
        /* Defensive coding: if called weirdly, try to minimal cleanup. End users/power users also suck! am one I know */
        if (!this.activeLeafWhenZenModeStarted && !document.body.classList.contains('obsidian-zen-mode-simulated-active')) {
            if (this.settings.debugMode) console.warn("Full Screen Toggle V2: EXIT SIMULATED - Called with no active leaf and body class not present. Attempting minimal cleanup.");
        }

        let leafEl = null; 
        if (this.activeLeafWhenZenModeStarted && this.activeLeafWhenZenModeStarted.view && this.activeLeafWhenZenModeStarted.view.containerEl) {
            leafEl = this.activeLeafWhenZenModeStarted.view.containerEl.closest('.workspace-leaf');
        } else {
             leafEl = document.querySelector('.workspace-leaf.zen-mode-active-leaf'); // Jeh Jeh backout if state is wonky.
        }

        if (leafEl) {
            leafEl.classList.remove('zen-mode-active-leaf', 'zen-animate');
        }
        document.body.classList.remove('obsidian-zen-mode-simulated-active');

        if (this.activeLeafWhenZenModeStarted) { // Remove styles if we know the leaf.
            this.removeStyles(this.activeLeafWhenZenModeStarted);
        }
        
        this.resetCssVariables();
        
        if(this.isZenModeActive) new obsidian.Notice("Zen mode (Simulated) deactivated", 1500);
        this.isZenModeActive = false;
        this.activeLeafWhenZenModeStarted = null;
        this.activeZenPresentation = null;
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: EXIT SIMULATED - Cleaned up.");
    };
    
    FullScreenPlugin.prototype.cleanupSimulatedFullscreenOnError = function () {
        // Safety net if simulated fullscreen entry goes wrong.
        const leafEl = document.querySelector('.workspace-leaf.zen-mode-active-leaf');
        if (leafEl) leafEl.classList.remove('zen-mode-active-leaf', 'zen-animate');
        document.body.classList.remove('obsidian-zen-mode-simulated-active');
        if (this.activeLeafWhenZenModeStarted) this.removeStyles(this.activeLeafWhenZenModeStarted);
        this.resetCssVariables();
        this.isZenModeActive = false;
        this.activeLeafWhenZenModeStarted = null;
        this.activeZenPresentation = null;
        new obsidian.Notice("Failed to enter Zen mode. Check console.", 3000);
    };

    /* --- ZEN MODE: NATIVE FULLSCREEN --- */
    FullScreenPlugin.prototype.enterNativeFullscreen = async function (leaf) {
        /* Uses the browser's actual fullscreen API. Meh Just adding it has it's upsides for non vim user. 
        Lolx actually it does: SOlves all issues with current multiwindow support and vertical tabs 
        more importantly it brings it's own issues like not exiting out with toggle on multiwindow support WTF!
        */
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: ENTERING NATIVE.");
        if (document.fullscreenElement) {
            new obsidian.Notice("Another element is already in native fullscreen.", 2000);
            return;
        }
        this.activeZenPresentation = 'native';
        const containerEl = leaf.view.containerEl;

        // Handler for when native fullscreen changes (e.g., user presses Esc).
        this.nativeFullscreenChangeHandler = () => {
            if (!document.fullscreenElement) { // If we exited native fullscreen...
                // ...and! it was our Zen mode doing it, then clean up.
                if (this.isZenModeActive && this.activeZenPresentation === 'native' && this.activeLeafWhenZenModeStarted === leaf) {
                    this.cleanupNativeFullscreenState(false); // false = not an error exit.
                }
            }
        };
        containerEl.addEventListener('fullscreenchange', this.nativeFullscreenChangeHandler);

        try {
            await containerEl.requestFullscreen();
            // Styles and body class applied after fullscreen is successful.
            requestAnimationFrame(() => { // Wait for next frame to be sure.
                this.addStyles(leaf);
                document.body.classList.add('obsidian-zen-mode-native-active');
            });
            this.isZenModeActive = true;
            new obsidian.Notice("Zen mode (Native) activated", 1500);
        } catch (err) { // Nada not figting you again
            console.error("Full Screen Toggle V2: Error requesting native fullscreen:", err);
            this.cleanupNativeFullscreenState(true); // true = error exit.
            new obsidian.Notice("Failed to enter native Zen mode.", 3000);
        }
    };

    FullScreenPlugin.prototype.exitNativeFullscreen = function () {
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: EXITING NATIVE.");
        if (document.fullscreenElement && this.isZenModeActive && this.activeZenPresentation === 'native' &&
            this.activeLeafWhenZenModeStarted && this.activeLeafWhenZenModeStarted.view.containerEl === document.fullscreenElement) {
            document.exitFullscreen(); // Tell the browser to leave. The event handler will do most cleanup.
        } else if (this.isZenModeActive && this.activeZenPresentation === 'native') {
            // Fallback: If state is weird but we think we're native, try to clean up.
            this.cleanupNativeFullscreenState(false);
        }
    };

    FullScreenPlugin.prototype.cleanupNativeFullscreenState = function (isErrorExit) {
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: Cleaning up native fullscreen state. Error exit:", isErrorExit);
        if (!this.activeLeafWhenZenModeStarted) { // If no active leaf, just minimal cleanup.
            document.body.classList.remove('obsidian-zen-mode-native-active');
            this.resetCssVariables();
            if (this.nativeFullscreenChangeHandler && document.fullscreenElement) {
                try { document.fullscreenElement.removeEventListener('fullscreenchange', this.nativeFullscreenChangeHandler); } catch(e){}
            }
            this.nativeFullscreenChangeHandler = null;
            return;
        }

        const leaf = this.activeLeafWhenZenModeStarted;
        const containerEl = leaf.view.containerEl;

        this.removeStyles(leaf); // Remove Zen-specific styles.
        document.body.classList.remove('obsidian-zen-mode-native-active');
        
        if (this.nativeFullscreenChangeHandler && containerEl) { 
            containerEl.removeEventListener('fullscreenchange', this.nativeFullscreenChangeHandler);
            this.nativeFullscreenChangeHandler = null;
        }
        this.resetCssVariables();

        if (!isErrorExit && this.isZenModeActive) new obsidian.Notice("Zen mode (Native) deactivated", 1500);
        
        this.isZenModeActive = false;
        this.activeLeafWhenZenModeStarted = null;
        this.activeZenPresentation = null;
    };

    /*
     * --- CROSS-PLATFORM FOCUS MODE ---
     * This mode just hides UI elements for a cleaner view, works on desktop & mobile.
     */
    FullScreenPlugin.prototype.toggleCrossPlatformFocusMode = function() {
        if (this.isCrossPlatformFocusActive) {
            this.deactivateCrossPlatformFocusMode();
        } else {
            if (!this.settings.enableCrossPlatformFocus) { // Setting check.
                if (this.settings.debugMode) console.log("Full Screen Toggle V2: Attempted to activate CP Focus, but it's disabled in settings.");
                return;
            }
            this.activateCrossPlatformFocusMode();
        }
    };

    FullScreenPlugin.prototype.activateCrossPlatformFocusMode = function() {
        if (this.isCrossPlatformFocusActive) return;
        if (!this.settings.enableCrossPlatformFocus) { // Double check. 😔 never too much
            if (this.settings.debugMode) console.log("Full Screen Toggle V2: activateCrossPlatformFocusMode called, but enableCrossPlatformFocus is false.");
            return;
        }
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: Activating Cross-Platform Focus.");
        if (this.isZenModeActive) {
            this.exitZenMode();
        }
        document.body.classList.add('obsidian-cross-platform-focus-active');
        this.updateCrossPlatformBodyClasses(); // Add specific hide classes based on settings.
        this.isCrossPlatformFocusActive = true;
        new obsidian.Notice("Cross-Platform Focus activated", 1500);
    };

    FullScreenPlugin.prototype.deactivateCrossPlatformFocusMode = function() {
        if (!this.isCrossPlatformFocusActive) return;
        if (this.settings.debugMode) console.log("Full Screen Toggle V2: Deactivating Cross-Platform Focus.");
        document.body.classList.remove('obsidian-cross-platform-focus-active');
        this.clearCrossPlatformBodyClasses(); // Remove all our hide classes.
        this.isCrossPlatformFocusActive = false;
        new obsidian.Notice("Cross-Platform Focus deactivated", 1500);
    };
    
    FullScreenPlugin.prototype.updateCrossPlatformBodyClasses = function() {
        // Slaps classes onto the body based on CP Focus settings.
        const body = document.body;
        const s = this.settings;
        const isMobile = obsidian.Platform.isMobile;

        const toggleBodyClass = (className, condition) => {
            condition ? body.classList.add(className) : body.classList.remove(className);
        };

        if (!isMobile) { // Desktop specific hides.
            toggleBodyClass('cp-hide-left-ribbon', s.cpHideLeftRibbon);
            // ... and so on for other desktop elements ...
            toggleBodyClass('cp-hide-right-ribbon', s.cpHideRightRibbon);
            toggleBodyClass('cp-hide-left-sidebar', s.cpHideLeftSidebar);
            toggleBodyClass('cp-hide-right-sidebar', s.cpHideRightSidebar);
            toggleBodyClass('cp-hide-status-bar', s.cpHideStatusBar);
            toggleBodyClass('cp-hide-top-tab-container', s.cpHideTopTabContainer);
        } else { // Mobile specific hides.
            toggleBodyClass('cp-mobile-hide-navbar', s.cpMobileHideNavbar);
            // ... and for mobile elements ...
            toggleBodyClass('cp-mobile-hide-view-header', s.cpMobileHideViewHeader);
            toggleBodyClass('cp-mobile-hide-tab-header-inner', s.cpMobileHideTabHeaderInner);
            if (obsidian.Platform.isTablet) { // Tablet special case.
                toggleBodyClass('cp-mobile-hide-tab-header-container-tablet', s.cpMobileHideTabHeaderContainerTablet);
            }
        }
    };

    FullScreenPlugin.prototype.clearCrossPlatformBodyClasses = function() {
        // Removes all possible CP Focus body classes. Simpler than checking one by one. = faster🏃🏽‍♂️‍➡️
        const body = document.body;
        const classesToRemove = [
            'cp-hide-left-ribbon', 'cp-hide-right-ribbon', 'cp-hide-left-sidebar',
            'cp-hide-right-sidebar', 'cp-hide-status-bar', 'cp-hide-top-tab-container',
            'cp-mobile-hide-navbar', 'cp-mobile-hide-view-header',
            'cp-mobile-hide-tab-header-inner', 'cp-mobile-hide-tab-header-container-tablet'
        ];
        classesToRemove.forEach(cls => body.classList.remove(cls));
    };

    /*
     * --- CLICK/TAP TRIGGER LOGIC ---
     * Handles toggling modes with multiple clicks/taps on the document.
     * Had to scrap the original implemetation
     */
    FullScreenPlugin.prototype.updateCrossPlatformClickListener = function() {
        this.removeCrossPlatformClickListener(); // Always remove existing before adding a new one.

        const clicksToTrigger = this.settings.crossPlatformTriggerClicks;
        if (clicksToTrigger === 0) { // 0 = disabled.
            if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click listener not added (clicks set to 0).");
            return;
        }

        // Check if the selected action (Zen or CP Focus) is actually enabled/viable.
        let actionIsViable = false;
        if (this.settings.clickActionTarget === "crossPlatformFocus") {
            actionIsViable = this.settings.enableCrossPlatformFocus;
        } else if (this.settings.clickActionTarget === "zenMode") {
            actionIsViable = true; // Zen is always available if plugin is on.
        }

        if (actionIsViable) {
            if (this.settings.debugMode) console.log("Full Screen Toggle V2: updateCrossPlatformClickListener - Conditions met, adding listener for " + clicksToTrigger + " clicks, action: " + this.settings.clickActionTarget);
            this.addCrossPlatformClickListener();
        } else {
            if (this.settings.debugMode) console.log("Full Screen Toggle V2: updateCrossPlatformClickListener - Conditions NOT met (action " + this.settings.clickActionTarget + " not viable). Listener not added.");
        }
    };

    FullScreenPlugin.prototype.addCrossPlatformClickListener = function() {
        if (this._boundCrossPlatformClickHandler) { // Double check
            if (this.settings.debugMode) console.log("Full Screen Toggle V2: addCrossPlatformClickListener - Listener already seems to exist. Aborting add.");
            return;
        }

        const eventType = obsidian.Platform.isMobile ? 'touchend' : 'click';
        const waitTime = 300; // ms to count consecutive clicks.
        const requiredClicks = this.settings.crossPlatformTriggerClicks;

        this._boundCrossPlatformClickHandler = (evt) => {
            const target = evt.target;
            if (this.settings.debugMode) console.log(`Full Screen Toggle V2: --- ${eventType} EVENT RECEIVED --- Target:`, target);

            // Double check if the feature is still enabled at event time.
            let effectivelyEnabled = false;
            if (this.settings.clickActionTarget === "crossPlatformFocus") {
                effectivelyEnabled = this.settings.enableCrossPlatformFocus && this.settings.crossPlatformTriggerClicks > 0;
            } else if (this.settings.clickActionTarget === "zenMode") {
                effectivelyEnabled = this.settings.crossPlatformTriggerClicks > 0;
            }

            if (!effectivelyEnabled) { // If disabled by settings, bail out!
                if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click event ignored at handler: feature/trigger disabled in settings.");
                this.clickListenerState.clickCount = 0;
                this.clickListenerState.lastClickTime = 0;
                return;
            }

            /*
             * --- CLICK IGNORE LOGIC (The Tricky Part!) ---
             * We don't want to trigger focus mode when clicking on UI elements,
             * input fields, modals, links, etc. That's super annoying.
             * This block tries to figure out if the click is "safe" to count. improvement over original idea especially with double click
             * Turn on debug mode for some fun!
             */
            const strictlyIgnoredSelectors = [
                'input', 'textarea', 'button', // Basic form elements
                '.modal', '.modal-container',   // Modals and their containers
                '.clickable-icon', '.setting-item', // Common UI interactive elements
                '.suggestion-item', '.menu-item', // Popups, menus
                '.prompt', '.prompt-input', '.prompt-buttons button', // Prompts
                '.view-header', '.workspace-tab-header-container', '.status-bar', // Main UI chrome
                '.workspace-ribbon', '.mobile-navbar',
                'a.internal-link', 'a.external-link', '.task-list-item-checkbox', // Links, checkboxes
                '.suggestion-item', '.suggestion-empty', '.prompt-suggestion-container' // Search/suggest
            ];

            let ignoreThisClick = false;
            if (target && typeof target.matches === 'function') {
                 ignoreThisClick = strictlyIgnoredSelectors.some(selector => {
                    try { return target.matches(selector) || target.closest(selector); } catch (e) {
                        if(this.settings.debugMode) console.warn("FSTV2: selector error", e); return false;
                    }
                });
            } else if (target) {
                 if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click target is not a standard element, proceeding.", target);
            }

            // ContentEditable: allow on main editor, ignore others (like title rename).
            if (!ignoreThisClick && target && typeof target.isContentEditable === 'boolean' && target.isContentEditable) {
                const isMainEditorClick = target.closest && (!!target.closest('.cm-editor') || !!target.closest('.markdown-reading-view'));
                if (!isMainEditorClick) {
                    ignoreThisClick = true; 
                    if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click IGNORED: Target is contentEditable but not main editor area.");
                }
            }
            
            // Modal open: be very careful. Ignore clicks on overlay or non-interactive modal parts.
            if (!ignoreThisClick && document.body.classList.contains('modal-open')) {
                const isClickInsideModalStructure = target.closest && (target.closest('.modal-container') || target.closest('.modal'));
                if (isClickInsideModalStructure) {
                    ignoreThisClick = true; // Assume interactive parts covered by selectors, others are passive.
                    if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click IGNORED: Non-interactive click inside an active modal.");
                } else {
                    ignoreThisClick = true;
                    if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click IGNORED: Click outside modal structure while modal is open.");
                }
            }
            // END OF IGNORE LOGIC

            if (ignoreThisClick) { // If we decided to ignore, reset and JAPAAA!
                if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click event final decision: IGNORED. Target:", target);
                this.clickListenerState.clickCount = 0;
                this.clickListenerState.lastClickTime = 0;
                return;
            }

            // If click is not ignored, count it.
            const now = Date.now();
            if ((now - this.clickListenerState.lastClickTime) < waitTime) {
                this.clickListenerState.clickCount++;
            } else { // Too long since last click, reset count.
                this.clickListenerState.clickCount = 1;
            }
            this.clickListenerState.lastClickTime = now;

            if (this.settings.debugMode) console.log(`Full Screen Toggle V2: Click count: ${this.clickListenerState.clickCount} / ${requiredClicks}. Last click time: ${this.clickListenerState.lastClickTime}`);

            if (this.clickListenerState.clickCount === requiredClicks) {
                if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click threshold MET.");
                let actionTaken = false;

                if (this.settings.clickActionTarget === "zenMode") {
                    if (this.settings.debugMode) console.log("Full Screen Toggle V2: Attempting to toggle ZenMode via click.");
                    this.toggleZenMode();
                    actionTaken = true;
                } else if (this.settings.clickActionTarget === "crossPlatformFocus") {
                    if (this.settings.enableCrossPlatformFocus) { // Final check if CP Focus is still enabled.
                        if (this.settings.debugMode) console.log("Full Screen Toggle V2: Attempting to toggle Cross-Platform Focus Mode via click.");
                        this.toggleCrossPlatformFocusMode();
                        actionTaken = true;
                    } else {
                        if (this.settings.debugMode) console.log("Full Screen Toggle V2: Click action for CP Focus, but it's disabled in settings.");
                    }
                } else {
                    console.warn("Full Screen Toggle V2: Unknown clickActionTarget setting:", this.settings.clickActionTarget);
                }

                if (actionTaken) {
                    this.clickListenerState.clickCount = 0;
                    this.clickListenerState.lastClickTime = 0;
                } else {
                    this.clickListenerState.clickCount = 0; // Reset even if no action (e.g. target disabled).
                }
            }
        };
        
        this.crossPlatformClickListener = this._boundCrossPlatformClickHandler;
        document.addEventListener(eventType, this.crossPlatformClickListener, { capture: true }); // Capture phase is important!
        if (this.settings.debugMode) console.log(`Full Screen Toggle V2: Cross-Platform click listener ADDED for ${eventType}, ${requiredClicks} clicks. Action: ${this.settings.clickActionTarget}`);
    };

    FullScreenPlugin.prototype.removeCrossPlatformClickListener = function() {
        if (this.crossPlatformClickListener) { // Only remove if it exists.
            const eventType = obsidian.Platform.isMobile ? 'touchend' : 'click';
            document.removeEventListener(eventType, this.crossPlatformClickListener, { capture: true });
            if (this.settings.debugMode) console.log("Full Screen Toggle V2: Cross-Platform click listener REMOVED.");
        }
        this.crossPlatformClickListener = null;
        this._boundCrossPlatformClickHandler = null;
        this.clickListenerState = { lastClickTime: 0, clickCount: 0 }; // Always reset state.
    };

    /* --- STYLE APPLICATORS (for Zen Mode mostly) --- */
    FullScreenPlugin.prototype.addStyles = function (leaf) {
        // Adds CSS classes to elements for Zen mode effects.
        if (!leaf || !leaf.view || !leaf.view.contentEl || !leaf.view.headerEl) {
            if (this.settings.debugMode) console.warn("Full Screen Toggle V2 AddStyles: Called with invalid leaf. Aborting.");
            return;
        }
        const viewEl = leaf.view.contentEl;
        const headerEl = leaf.view.headerEl;
        const isGraph = leaf.view.getViewType() === "graph";

        let graphControls;
        if (isGraph && leaf.view.dataEngine && typeof leaf.view.dataEngine.controlsEl !== 'undefined') {
             graphControls = leaf.view.dataEngine.controlsEl;
        }

        if (!this.settings.showScroll) { viewEl.classList.add("zen-noscroll"); } // No scroll bar
        if (isGraph && graphControls && !this.settings.showGraphControls) { graphControls.classList.add("zen-hide"); } // Graph controls too.

        // Vignette effect Still not working as inteneded
        if (this.settings.vignetteOpacity > 0) {
            isGraph ? viewEl.classList.add("zen-vignette-radial") : viewEl.classList.add("zen-vignette-linear");
        }

        // Readable line width / content centering.
        if (!isGraph && this.settings.forceReadable) {
            if (leaf.view instanceof obsidian.MarkdownView) { // Markdown views need special handling for editor/preview.
                const markdownView = leaf.view;
                if (markdownView.editor && markdownView.editor.editorEl) { // Legacy CM5 editor.
                    markdownView.editor.editorEl.classList.add("is-readable-line-width");
                } else if (markdownView.editor && markdownView.contentEl) { // CM6 editor.
                    const cmEditorDiv = markdownView.contentEl.querySelector('.cm-editor');
                    if (cmEditorDiv) cmEditorDiv.classList.add("is-readable-line-width");
                } else if (markdownView.previewMode && markdownView.contentEl) { // Preview mode.
                    markdownView.contentEl.classList.add("zen-force-readable-preview");
                } else {
                     if (this.settings.debugMode) console.warn("Full Screen Toggle V2 AddStyles: MarkdownView readable width elements not found.");
                }
            } else { // For other view types, a generic readable class.
                 viewEl.classList.add("zen-generic-readable");
            }
        }
        
        viewEl.classList.add("zen-animate"); // Fade in, smooth. I hope...
        // Header visibility toggle.
        this.settings.showHeader ? headerEl.classList.remove("zen-hide") : headerEl.classList.add("zen-hide");
        if (this.settings.showHeader) headerEl.classList.add("zen-animate"); // Animate header if shown.
    };

    FullScreenPlugin.prototype.removeStyles = function (leaf) {
        // Cleans up all the CSS classes we added.
        if (!leaf || !leaf.view || !leaf.view.contentEl || !leaf.view.headerEl) {
            if (this.settings.debugMode) console.warn("Full Screen Toggle V2 RemoveStyles: Called with invalid leaf. Aborting.");
            return;
        }
        const viewEl = leaf.view.contentEl;
        const headerEl = leaf.view.headerEl;
        const isGraph = leaf.view.getViewType() === "graph";

        let graphControls; // Make graph controls visible again.
        if (isGraph && leaf.view.dataEngine && typeof leaf.view.dataEngine.controlsEl !== 'undefined') {
            graphControls = leaf.view.dataEngine.controlsEl;
            graphControls.classList.remove("zen-hide");
        }

        // Remove all our Zen-specific classes.
        viewEl.classList.remove("zen-noscroll", "zen-vignette-radial", "zen-vignette-linear", "zen-generic-readable", "zen-animate");
        headerEl.classList.remove("zen-hide", "zen-animate");

        // Special cleanup for Markdown views.
        if (leaf.view instanceof obsidian.MarkdownView) {
            const markdownView = leaf.view;
            if (markdownView.editor && markdownView.editor.editorEl) { // CM5
                markdownView.editor.editorEl.classList.remove("is-readable-line-width");
            }
             if (markdownView.contentEl) { // CM6 and Preview
                const cmEditorDiv = markdownView.contentEl.querySelector('.cm-editor');
                if (cmEditorDiv) cmEditorDiv.classList.remove("is-readable-line-width");
                markdownView.contentEl.classList.remove("zen-force-readable-preview");
            }
        }
    };

    return FullScreenPlugin;
}(obsidian.Plugin));

/*
 * --- PLUGIN SETTINGS TAB ---
 * This is the UI for configuring all the bits and bobs.
 * Pretty standard Obsidian plugin settings stuff.
 */
var ZenModeSettingTab = /** @class */ (function (_super) {
    __extends(ZenModeSettingTab, _super);
    function ZenModeSettingTab(app, plugin) {
        var _this = _super.call(this, app, plugin) || this;
        _this.plugin = plugin;
        return _this;
    }
    ZenModeSettingTab.prototype.display = function () {
        var _this = this;
        var containerEl = this.containerEl;
        containerEl.empty();

        containerEl.createEl("h1", { text: "Full Screen Toggle V2 Settings" });
        containerEl.createEl("hr");

        // --- Tap Trigger (For Both modes) ---
        const tapTriggerDetails = containerEl.createEl('details');
        const tapTriggerSummary = tapTriggerDetails.createEl('summary');
        tapTriggerSummary.createEl('h3', { text: "Tap Trigger (For Both Modes)", cls: "summary-heading" }); // Add class
        const tapTriggerContainer = tapTriggerDetails.createDiv();

        new obsidian.Setting(tapTriggerContainer)
            .setName("Tap Action Target")
            .setDesc("What happens when you do the clicky-tap gesture.")
            .addDropdown(dropdown => dropdown
                .addOption("crossPlatformFocus", "Focus Mode")
                .addOption("zenMode", "Active Note Mode")
                .setValue(this.plugin.settings.clickActionTarget)
                .onChange(async (value) => {
                    this.plugin.settings.clickActionTarget = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(tapTriggerContainer)
            .setName("Trigger with consecutive clicks/taps")
            .setDesc("How many times to click/tap to trigger the action. 'Disabled' turns this off.")
            .addDropdown(dropdown => dropdown
                .addOption("0", "Disabled")
                .addOption("2", "2 clicks/taps")
                .addOption("3", "3 clicks/taps (Default)")
                .setValue(String(this.plugin.settings.crossPlatformTriggerClicks))
                .onChange(async (value) => {
                    this.plugin.settings.crossPlatformTriggerClicks = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl("hr");

        // --- Active Note Mode (Active Leaf Mode / ANM) ---
        const anmDetails = containerEl.createEl('details');
        const anmSummary = anmDetails.createEl('summary');
        anmSummary.createEl('h3', { text: "Active Note Mode (ANM)", cls: "summary-heading" }); // Add class
        const anmContainer = anmDetails.createDiv();

        new obsidian.Setting(anmContainer)
            .setName("ANM Presentation") // Renamed from Zen Mode Selector
            .setDesc("Choose how ANM makes the active leaf fullscreen. 'Simulated' is usually smoother.")
            .addDropdown(dropdown => dropdown
                .addOption("simulated", "Simulated (CSS-based)")
                .addOption("native", "Native (Browser Fullscreen API)")
                .setValue(this.plugin.settings.zenModePresentation)
                .onChange(async (value) => {
                    this.plugin.settings.zenModePresentation = value;
                    await this.plugin.saveSettings();
                }));

        // ANM: Vignette Settings (Collapsible)
        const anmVignetteDetails = anmContainer.createEl('details');
        // anmVignetteDetails.open = true; // Open by default if desired
        anmVignetteDetails.createEl('summary', { text: "ANM: Vignette Settings (Shadowy Edges)" });
        const anmVignetteContainer = anmVignetteDetails.createDiv();

        new obsidian.Setting(anmVignetteContainer) // Moved Fade-in here as "Animation"
            .setName('Animation: Fade-in duration')
            .setDesc('How long stuff takes to fade in for ANM (seconds).')
            .addText(text => text
                .setPlaceholder('e.g. 1.2')
                .setValue(String(this.plugin.settings.animationDuration))
                .onChange(async (value) => {
                    var numValue = parseFloat(value);
                    if (isNaN(numValue) || numValue < 0) numValue = DEFAULT_SETTINGS.animationDuration;
                    this.plugin.settings.animationDuration = numValue;
                    text.setValue(String(numValue));
                    await this.plugin.saveSettings();
                }));
        
        var vignetteOpacityNumber;
        new obsidian.Setting(anmVignetteContainer)
            .setName('Vignette: Opacity')
            .setDesc("How dark the vignette is. 0 to turn it off completely.")
            .addSlider(slider => slider
                .setLimits(0.00, 1, 0.01)
                .setValue(this.plugin.settings.vignetteOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    vignetteOpacityNumber.innerText = " " + value.toFixed(2);
                    this.plugin.settings.vignetteOpacity = value;
                    await this.plugin.saveSettings();
                }))
            .controlEl.createDiv({ cls: "setting-item-control-meta" }, el => {
                vignetteOpacityNumber = el; el.style.minWidth = "2.3em"; el.style.textAlign = "right";
                el.innerText = " " + this.plugin.settings.vignetteOpacity.toFixed(2);
            });

        var vignetteScaleLinearNumber;
        new obsidian.Setting(anmVignetteContainer)
            .setName('Vignette: Scale in text views (%)')
            .setDesc("How far the vignette spreads from sides for normal text views.")
            .addSlider(slider => slider
                .setLimits(5, 50, 1)
                .setValue(this.plugin.settings.vignetteScaleLinear)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    vignetteScaleLinearNumber.innerText = " " + value.toString();
                    this.plugin.settings.vignetteScaleLinear = value;
                    await this.plugin.saveSettings();
                }))
            .controlEl.createDiv({ cls: "setting-item-control-meta" }, el => {
                vignetteScaleLinearNumber = el; el.style.minWidth = "2.0em"; el.style.textAlign = "right";
                el.innerText = " " + this.plugin.settings.vignetteScaleLinear.toString();
            });

        var vignetteScaleRadialNumber;
        new obsidian.Setting(anmVignetteContainer)
            .setName('Vignette: Scale in graph view (%)')
            .setDesc("Vignette spread for graph view (more circular).")
            .addSlider(slider => slider
                .setLimits(5, 100, 1)
                .setValue(this.plugin.settings.vignetteScaleRadial)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    vignetteScaleRadialNumber.innerText = " " + value.toString();
                    this.plugin.settings.vignetteScaleRadial = value;
                    await this.plugin.saveSettings();
                }))
            .controlEl.createDiv({ cls: "setting-item-control-meta" }, el => {
                vignetteScaleRadialNumber = el; el.style.minWidth = "2.3em"; el.style.textAlign = "right";
                el.innerText = " " + this.plugin.settings.vignetteScaleRadial.toString();
            });

        // ANM: Element Toggles (Collapsible)
        const anmElementTogglesDetails = anmContainer.createEl('details');
        anmElementTogglesDetails.createEl('summary', { text: "ANM: Element Toggles" });
        const anmElementTogglesContainer = anmElementTogglesDetails.createDiv();

        new obsidian.Setting(anmElementTogglesContainer).setName("Show header").addToggle(t=>t.setValue(this.plugin.settings.showHeader).onChange(async v=>{this.plugin.settings.showHeader=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(anmElementTogglesContainer).setName("Show scrollbar").addToggle(t=>t.setValue(this.plugin.settings.showScroll).onChange(async v=>{this.plugin.settings.showScroll=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(anmElementTogglesContainer).setName("Show graph controls").addToggle(t=>t.setValue(this.plugin.settings.showGraphControls).onChange(async v=>{this.plugin.settings.showGraphControls=v; await this.plugin.saveSettings();}));

        // ANM: Misc (Collapsible, or directly if only one item)
        const anmMiscDetails = anmContainer.createEl('details');
        anmMiscDetails.open = true; // Open by default if desired
        anmMiscDetails.createEl('summary', { text: "ANM: Misc" });
        const anmMiscContainer = anmMiscDetails.createDiv();
        new obsidian.Setting(anmMiscContainer).setName("Force content centering (readable width)").addToggle(t=>t.setValue(this.plugin.settings.forceReadable).onChange(async v=>{this.plugin.settings.forceReadable=v; await this.plugin.saveSettings();}));


        containerEl.createEl("hr");

        // --- Focus Mode (UI Hiding) ---
        const focusModeDetails = containerEl.createEl('details');
        const focusModeSummary = focusModeDetails.createEl('summary');
        focusModeSummary.createEl('h3', { text: "Focus Mode (UI Hiding)", cls: "summary-heading" }); // Add class
        const focusModeContainer = focusModeDetails.createDiv();

        new obsidian.Setting(focusModeContainer)
            .setName("Enable Focus Mode")
            .setDesc("Hides general UI bits. Can be triggered by the tap gesture.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableCrossPlatformFocus)
                .onChange(async (value) => {
                    this.plugin.settings.enableCrossPlatformFocus = value;
                    await this.plugin.saveSettings();
                    if (!value && this.plugin.isCrossPlatformFocusActive) {
                        this.plugin.deactivateCrossPlatformFocusMode();
                    }
                }));

        // Focus Mode: Desktop Elements to Hide (Collapsible)
        const fmDesktopDetails = focusModeContainer.createEl('details');
        fmDesktopDetails.createEl('summary', { text: "Focus Mode: Desktop Elements to Hide" });
        const fmDesktopContainer = fmDesktopDetails.createDiv();
        new obsidian.Setting(fmDesktopContainer).setName("Left Ribbon").addToggle(t=>t.setValue(this.plugin.settings.cpHideLeftRibbon).onChange(async v=>{this.plugin.settings.cpHideLeftRibbon=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(fmDesktopContainer).setName("Right Ribbon").addToggle(t=>t.setValue(this.plugin.settings.cpHideRightRibbon).onChange(async v=>{this.plugin.settings.cpHideRightRibbon=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(fmDesktopContainer).setName("Left Sidebar (Split)").addToggle(t=>t.setValue(this.plugin.settings.cpHideLeftSidebar).onChange(async v=>{this.plugin.settings.cpHideLeftSidebar=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(fmDesktopContainer).setName("Right Sidebar (Split)").addToggle(t=>t.setValue(this.plugin.settings.cpHideRightSidebar).onChange(async v=>{this.plugin.settings.cpHideRightSidebar=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(fmDesktopContainer).setName("Status Bar").addToggle(t=>t.setValue(this.plugin.settings.cpHideStatusBar).onChange(async v=>{this.plugin.settings.cpHideStatusBar=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(fmDesktopContainer).setName("Top Tab Bar/Header").addToggle(t=>t.setValue(this.plugin.settings.cpHideTopTabContainer).onChange(async v=>{this.plugin.settings.cpHideTopTabContainer=v; await this.plugin.saveSettings();}));

        // Focus Mode: Mobile Elements to Hide (Collapsible)
        const fmMobileDetails = focusModeContainer.createEl('details');
        fmMobileDetails.createEl('summary', { text: "Focus Mode: Mobile Elements to Hide" });
        const fmMobileContainer = fmMobileDetails.createDiv();
        new obsidian.Setting(fmMobileContainer).setName("Mobile: Bottom Navbar").addToggle(t=>t.setValue(this.plugin.settings.cpMobileHideNavbar).onChange(async v=>{this.plugin.settings.cpMobileHideNavbar=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(fmMobileContainer).setName("Mobile: View Header").setDesc("Careful, this one can sometimes cause issues on mobile.").addToggle(t=>t.setValue(this.plugin.settings.cpMobileHideViewHeader).onChange(async v=>{this.plugin.settings.cpMobileHideViewHeader=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(fmMobileContainer).setName("Mobile: Active Tab Header").addToggle(t=>t.setValue(this.plugin.settings.cpMobileHideTabHeaderInner).onChange(async v=>{this.plugin.settings.cpMobileHideTabHeaderInner=v; await this.plugin.saveSettings();}));
        new obsidian.Setting(fmMobileContainer).setName("Tablet: Top Tab Bar").setDesc("For tablets, hides the main tab container thingy.").addToggle(t=>t.setValue(this.plugin.settings.cpMobileHideTabHeaderContainerTablet).onChange(async v=>{this.plugin.settings.cpMobileHideTabHeaderContainerTablet=v; await this.plugin.saveSettings();}));


        containerEl.createEl("hr");

        // --- Debugging ---
        containerEl.createEl("h3", { text: "Debugging" });
        new obsidian.Setting(containerEl)
            .setName("Enable Debug Mode")
            .setDesc("Spits out more stuff to the console if things are acting weird.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    };
    return ZenModeSettingTab;
}(obsidian.PluginSettingTab));

module.exports = FullScreenPlugin;