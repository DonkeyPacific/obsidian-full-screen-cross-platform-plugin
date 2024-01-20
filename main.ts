import { I18n } from 'i18n';
import { App, Plugin, PluginSettingTab, Setting, moment } from 'obsidian';
import { Platform } from "obsidian";

interface CrossPlatformFullScreenSettings {
	consecutiveClickTimes: string;
}

const DEFAULT_SETTINGS: Partial<CrossPlatformFullScreenSettings> = {
	consecutiveClickTimes: '2'
};

export default class CrossPlatformFullScreenPlugin extends Plugin {
	settings: CrossPlatformFullScreenSettings;
	elementsStatusMap: Map<string, string> = new Map<string, string>();
	i18n: I18n;

	handleClickFunc: (evt: Event) => void;

	async onload() {
		await this.loadSettings();
		// add command
		this.addCommand({
			id: 'toggle-full-screen-cross-platform',
			name: 'Full screen',
			callback: async () => {
				this.toggleFullScreen();
			}
		});

		this.i18n = new I18n(moment.locale());
		this.addTouchEventListener();

		this.addSettingTab(new SettingTab(this.app, this));
	}

	addTouchEventListener() {
		const clickEventName = Platform.isMobile ? 'touchend' : 'click';
		if (this.handleClickFunc) {
			document.removeEventListener(clickEventName, this.handleClickFunc);
		}
		const waitTime = 300;
		const maxCount = parseInt(this.settings.consecutiveClickTimes);
		let lastTouchEnd = 0;
		let touchCount = 0;
		this.handleClickFunc = async (evt: Event) => {
			const now = (new Date()).getTime();
			touchCount = (now - lastTouchEnd) < waitTime ? touchCount + 1 : 1;
			lastTouchEnd = now;
			if (touchCount === maxCount) {
				await this.toggleFullScreen();
			}
		}

		document.addEventListener(clickEventName, this.handleClickFunc);
	}

	async toggle(toggleClassList: string[]) {
		toggleClassList.forEach((cls) => {
			const elements = document.querySelectorAll(cls);
			if (cls && elements) {
				elements.forEach((element, i) => {
					const cname = 'fullscreen-cross-platform-hidden';
					if(element.classList.contains(cname)){
						element.removeClass(cname);
					} else{
						element.addClass(cname);
					}
				});
			}
		});
	}

	async toggleFullScreen() {
		if (Platform.isMobile) {
			this.toggle(['.mobile-navbar', '.view-header']);
		} else if (Platform.isDesktop) {
			this.toggle(['.workspace-ribbon.side-dock-ribbon.mod-left',
				'.workspace-split.mod-horizontal.mod-left-split',
				'.workspace-tab-header-container',
				'.workspace-split.mod-horizontal.mod-right-split'
			]);
		}
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.addTouchEventListener();
	}
}

class SettingTab extends PluginSettingTab {
	plugin: CrossPlatformFullScreenPlugin;

	constructor(app: App, plugin: CrossPlatformFullScreenPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const i18n = this.plugin.i18n;
		containerEl.createEl('h3', { text: i18n.t('settingsTitle') });
		// containerEl.createEl('hr');

		new Setting(containerEl)
			.setName(i18n.t('toggleMouseShortcuts'))
			.setDesc(i18n.t('toggleMouseShortcutsDes'))
			.addDropdown(component => {
				component
					.addOption('2', i18n.t("doubleClick"))
					.addOption('3', i18n.t("tripleClick"))
					.setValue(this.plugin.settings.consecutiveClickTimes)
					.onChange((value) => {
						this.plugin.settings.consecutiveClickTimes = value;
						this.plugin.saveSettings();
					});
			});
	}
}
