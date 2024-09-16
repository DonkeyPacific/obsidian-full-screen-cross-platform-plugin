export const TRANSLATION_EN = new Map<string, string>([
	["toggleMouseShortcuts", "Fullscreen toggle shortcut"],
	["toggleMouseShortcutsDes", "The number of consecutive mouse or touchscreen clicks, with a time interval between two clicks less than 300ms."],
	["doubleClick", "double click"],
	["tripleClick", "triple click"],
	["noClick", "do not trigger on clicks"]
]);

export const TRANSLATION_CH = new Map<string, string>([
	["toggleMouseShortcuts", "全屏切换快捷键"],
	["toggleMouseShortcutsDes", "鼠标或触屏连续点击次数，两次点击时间间隔需小于300ms。"],
	["doubleClick", "双击"],
	["tripleClick", "三连击"],
	["noClick", "没有点击"]
]);

export const TRANSLATION_JA = new Map<string, string>([
	["toggleMouseShortcuts", "フルスクリーン切り替えショートカット"],
	["toggleMouseShortcutsDes", "マウスまたはタッチスクリーンの連続クリック回数、2回のクリック間隔は300ms未満である必要があります"],
	["doubleClick", "ダブルクリック"],
	["tripleClick", "トリプルクリック"],
	["noClick", "クリックなし"]
]);

export const TRANSLATION_KO = new Map<string, string>([
	["toggleMouseShortcuts", "전체 화면 전환 바로 가기"],
	["toggleMouseShortcutsDes", "마우스 또는 터치스크린 연속 클릭 횟수, 2회 클릭 간격은 300ms 미만이어야 합니다"],
	["doubleClick", "더블 클릭"],
	["tripleClick", "트리플 클릭"],
	["noClick", "클릭 없음"]
]);

export const TRANSLATION_UK = new Map<string, string>([
	["toggleMouseShortcuts", "Горячая клавиша переключения полноэкранного режима"],
	["toggleMouseShortcutsDes", "оличество последовательных кликов мыши или сенсорного экрана с интервалом времени менее 300 мс"],
	["doubleClick", "Двойной щелчок"],
	["tripleClick", "Тройной щелчок"],
	["noClick", "нет кликов"]
]);

export const TRANSLATION_TW = new Map<string, string>([
	["toggleMouseShortcuts", "全螢幕切換快速鍵"],
	["toggleMouseShortcutsDes", "鼠標或觸控螢幕連點次數，兩次點擊時間間隔需小於300毫秒"],
	["doubleClick", "雙擊"],
	["tripleClick", "三擊"],
	["noClick", "沒有點擊"]
]);
export const TRANSLATION = new Map<string, Map<string, string>>([
	['en', TRANSLATION_EN],
	['zh-cn', TRANSLATION_CH],
	['ja', TRANSLATION_JA],
	['ko', TRANSLATION_KO],
	['uk', TRANSLATION_UK],
	['zh-tw', TRANSLATION_TW]
]);

// export const TRANSLATION_ = new Map<string, string>([
// 	["settingsTitle", ""],
// 	["toggleMouseShortcuts", ""],
// 	["toggleMouseShortcutsDes", ""],
// 	["doubleClick", ""],
// 	["tripleClick", ""],
// 	["noClick", ""]
// ]);

export class I18n {

	lang: string;

	constructor(
		lang: string
	) {
		this.lang = lang;
	}

	t(key: string): string{
		const langPack = TRANSLATION.get(this.lang);
		const langBackendPack = TRANSLATION_EN;
		let value = null;
		if(langPack && langPack.has(key)){
			value = langPack.get(key)
		} else if(langBackendPack && langBackendPack.has(key)){
			value = langBackendPack.get(key);
		}
		if(value){
			return value;
		}
		return key;
	}
}
