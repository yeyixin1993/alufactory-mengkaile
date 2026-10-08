import React,{createContext,useContext} from 'react';
import {Language} from '../types';
export const AILanguageContext=createContext<Language>('cn');
const messages:Record<string,[string,string]>={
  "AI 设计顾问": [
    "AI Design Advisor",
    "AI 設計アドバイザー"
  ],
  "AI 顾问": [
    "AI Advisor",
    "AI アドバイザー"
  ],
  "AI 设计与咨询": [
    "AI design consultation",
    "AI 設計相談"
  ],
  "你": [
    "You",
    "あなた"
  ],
  "新对话": [
    "New chat",
    "新しいチャット"
  ],
  "当前对话": [
    "Current chat",
    "現在のチャット"
  ],
  "聊聊你的想法": [
    "Tell us your idea",
    "アイデアを教えてください"
  ],
  "价格画册": [
    "Price catalog",
    "価格カタログ"
  ],
  "3D 设计器": [
    "3D Designer",
    "3D デザイナー"
  ],
  "购物车": [
    "Cart",
    "カート"
  ],
  "返回首页": [
    "Home",
    "ホーム"
  ],
  "我的账户": [
    "My account",
    "マイアカウント"
  ],
  "登录 / 注册": [
    "Log in / Sign up",
    "ログイン / 登録"
  ],
  "访": [
    "G",
    "ゲスト"
  ],
  "关闭咨询导航": [
    "Close navigation",
    "ナビを閉じる"
  ],
  "关闭侧栏": [
    "Close sidebar",
    "サイドバーを閉じる"
  ],
  "打开咨询导航": [
    "Open navigation",
    "ナビを開く"
  ],
  "咨询记录": [
    "Chat history",
    "相談履歴"
  ],
  "本地测试 · 不限额度": [
    "Local test · Unlimited",
    "ローカルテスト・制限なし"
  ],
  "额度暂不可用": [
    "Balance unavailable",
    "残高を取得できません"
  ],
  "正在读取额度…": [
    "Loading balance…",
    "残高を読み込み中…"
  ],
  "充值": [
    "Top up",
    "チャージ"
  ],
  "收支记录": [
    "Transactions",
    "利用履歴"
  ],
  "刷新余额": [
    "Refresh balance",
    "残高を更新"
  ],
  "想做点什么？可以直接发清单或图片，我们一起确认规格和加工。": [
    "What would you like to build? Send a list or image to work out the specifications and machining.",
    "何を作りますか？リストや画像を送って、仕様と加工を確認しましょう。"
  ],
  "本条需求附图": [
    "Attached reference image",
    "添付参考画像"
  ],
  "正在整理你的需求…": [
    "Working on your request…",
    "ご要望を整理しています…"
  ],
  "开始新咨询（不重置额度）": [
    "New chat (balance stays unchanged)",
    "新しい相談（残高は変わりません）"
  ],
  "确认以上识别信息": [
    "I confirm the recognized information",
    "上記の認識内容を確認しました"
  ],
  "确认识别信息（填入后发送）": [
    "Confirm recognition (insert and send)",
    "認識内容を確認（入力して送信）"
  ],
  "待发送图片": [
    "Image to send",
    "送信する画像"
  ],
  "图片将在发送时交给 AI 识别": [
    "The image will be analyzed when sent.",
    "送信時に AI が画像を解析します。"
  ],
  "移除图片": [
    "Remove image",
    "画像を削除"
  ],
  "描述你的设计或型材需求": [
    "Describe your design or profile requirements",
    "設計やアルミフレームの要望を入力"
  ],
  "想做点什么？例如：2020 粉色型材，1000mm，两端攻丝…": [
    "What would you like to make? E.g. pink 2020 profile, 1000mm, tapped at both ends…",
    "例：2020 ピンク、1000mm、両端タップ加工…"
  ],
  "上传图片": [
    "Upload image",
    "画像をアップロード"
  ],
  "正在处理": [
    "Processing",
    "処理中"
  ],
  "发送需求": [
    "Send message",
    "送信"
  ],
  "开始咨询": [
    "Start chat",
    "相談を始める"
  ],
  "本地测试不限额度 · AI 识别结果请核对": [
    "Unlimited local testing · Please check AI recognition results",
    "ローカルテストは制限なし・AI の認識結果をご確認ください"
  ],
  "游客及普通用户免费发送 3 条消息，回复追问也计入次数。VIP/VIP+ 使用账户额度。": [
    "Guests and standard users get 3 free messages, including follow-ups. VIP/VIP+ use account credit.",
    "ゲスト・一般会員は追加回答を含め3通まで無料。VIP/VIP+ はアカウント残高を使用します。"
  ],
  "AI 额度充值 · 充多少到账多少": [
    "AI credit · Receive the full top-up amount",
    "AI 残高・チャージ額がそのまま反映されます"
  ],
  "请先": [
    "Please ",
    "まず"
  ],
  "登录": [
    "log in",
    "ログイン"
  ],
  "，方便将充值额度记入您的账号。": [
    " to add credit to your account.",
    "して、アカウントにチャージしてください。"
  ],
  "充值金额": [
    "Top-up amount",
    "チャージ金額"
  ],
  "正在创建付款…": [
    "Preparing payment…",
    "決済を準備中…"
  ],
  "支付宝充值": [
    "Top up with Alipay",
    "Alipay でチャージ"
  ],
  "支付宝确认支付成功后自动到账。微信扫码付款由管理员核实后手动增加额度。": [
    "Alipay payments are credited automatically. WeChat payments are credited after administrator verification.",
    "Alipay は決済後に自動反映。WeChat 決済は管理者の確認後に反映されます。"
  ],
  "微信收款码": [
    "WeChat payment QR code",
    "WeChat 決済 QR コード"
  ],
  "微信付款后请提供账号手机号、付款金额及交易凭证。": [
    "After paying with WeChat, provide your account phone number, amount and payment receipt.",
    "WeChat 決済後、登録電話番号・金額・支払い控えをご提示ください。"
  ],
  "请联系网站客服核实到账。": [
    "Contact support to confirm payment.",
    "入金確認はサポートへご連絡ください。"
  ],
  "关闭收支记录": [
    "Close transactions",
    "履歴を閉じる"
  ],
  "暂无记录。": [
    "No transactions yet.",
    "履歴はありません。"
  ],
  "赠送": [
    "Granted credit",
    "付与"
  ],
  "使用": [
    "Usage",
    "利用"
  ],
  "试用": [
    "Trial",
    "お試し"
  ],
  "常见问答（免费）": [
    "FAQ (free)",
    "FAQ（無料）"
  ],
  "人工调整": [
    "Manual adjustment",
    "手動調整"
  ],
  "快速报价": [
    "Quick quote",
    "簡易見積り"
  ],
  "部分清单估价": [
    "Partial estimate",
    "一部の見積り"
  ],
  " · 图片待核对": [
    " · Image confirmation pending",
    "・画像の確認待ち"
  ],
  "VIP 价": [
    "VIP price",
    "VIP 価格"
  ],
  "VIP+ 价": [
    "VIP+ price",
    "VIP+ 価格"
  ],
  "普通售价": [
    "Standard price",
    "通常価格"
  ],
  "铝型材材料及加工": [
    "Profiles and machining",
    "型材・加工費"
  ],
  "运费待定 · 当前金额不含运费，可稍后在购物车填写地址计算。": [
    "Shipping pending · Enter your address in the cart to calculate shipping.",
    "送料未定・カートで住所を入力すると計算できます。"
  ],
  "发往": [
    "Ship to",
    "配送先"
  ],
  "预估重量": [
    "Estimated weight",
    "推定重量"
  ],
  "运费": [
    "Shipping",
    "送料"
  ],
  "已计价部分": [
    "Priced items",
    "見積済み分"
  ],
  "材料及已知加工": [
    "Materials and specified machining",
    "材料・指定済み加工"
  ],
  "预估合计": [
    "Estimated total",
    "見積合計"
  ],
  "这是暂估，不是生产订单。未明确的项目、加工和配件未包含，待确认内容见下方。": [
    "Estimate only. Unspecified items, machining and accessories are not included. See pending details below.",
    "概算です。未確定の商品・加工・部品は含みません。下記をご確認ください。"
  ],
  "详情清单": [
    "Details",
    "明細"
  ],
  "尚未计价（不包含在上方金额中）": [
    "Not yet priced (excluded above)",
    "未見積り（上記金額に含みません）"
  ],
  "型号待确认": [
    "Model to confirm",
    "型番未確認"
  ],
  "继续确认": [
    "To confirm",
    "確認事項"
  ],
  "端面攻丝": [
    "End tapping",
    "端面タップ"
  ],
  "通孔": [
    "Through hole",
    "貫通穴"
  ],
  "沉头孔": [
    "Counterbore",
    "座ぐり穴"
  ],
  "螺纹孔": [
    "Threaded hole",
    "ねじ穴"
  ],
  "45°斜切": [
    "45° miter cut",
    "45°斜め切断"
  ],
  "本色截面": [
    "Natural cut ends",
    "本色断面"
  ],
  "彩色截面": [
    "Colored cut ends",
    "カラー断面"
  ],
  "型材": [
    "Profile",
    "型材"
  ],
  "查看清单项": [
    "Select item",
    "項目を選択"
  ],
  "已核对": [
    "confirmed",
    "確認済み"
  ],
  "加载立体图…": [
    "Loading 3D preview…",
    "3D プレビューを読み込み中…"
  ],
  "编辑加工": [
    "Edit machining",
    "加工を編集"
  ],
  "编辑型材加工": [
    "Edit profile machining",
    "型材加工を編集"
  ],
  "加工标注": [
    "Machining details",
    "加工注記"
  ],
  "左端攻丝": [
    "Left-end tapping",
    "左端タップ"
  ],
  "右端攻丝": [
    "Right-end tapping",
    "右端タップ"
  ],
  "左端": [
    "Left end",
    "左端"
  ],
  "右端": [
    "Right end",
    "右端"
  ],
  "向上": [
    "Up",
    "上向き"
  ],
  "向下": [
    "Down",
    "下向き"
  ],
  "未明确的孔位或斜切未画出，请在对话中补充。": [
    "Unspecified holes or miter cuts are not shown. Please clarify in chat.",
    "未確定の穴や斜め切断は表示されません。チャットで補足してください。"
  ],
  "确认本项配置": [
    "Confirm this item",
    "この項目を確認"
  ],
  "一键确认全部型材": [
    "Confirm all profiles",
    "すべての型材を確認"
  ],
  "正在核对…": [
    "Checking…",
    "確認中…"
  ],
  "加入购物车": [
    "Add to cart",
    "カートに追加"
  ],
  "本次仅加入型材，配件可自行购买或稍后另配。": [
    "Profiles only. Accessories can be purchased separately.",
    "今回は型材のみ。部品は別途購入できます。"
  ],
  "历史方案，请在最新回复中确认。": [
    "Previous configuration. Confirm in the latest reply.",
    "過去の構成です。最新の返信で確認してください。"
  ],
  "购物车已有商品": [
    "Your cart already has items",
    "カートに商品があります"
  ],
  "要在原购物车基础上添加本次清单，还是用本次清单覆盖原购物车？": [
    "Add this list to your cart, or replace the existing cart?",
    "このリストを追加しますか？既存のカートを置き換えますか？"
  ],
  "原有商品": [
    "Existing items",
    "既存の商品"
  ],
  "本次型材及加工": [
    "New profiles and machining",
    "今回の型材・加工"
  ],
  "追加保留原有商品及配件；覆盖只留下本次型材。运费在购物车按地址计算。": [
    "Add keeps existing items. Replace keeps only this list. Shipping is calculated from the cart address.",
    "追加は既存の商品を保持し、置換は今回のリストのみを残します。送料はカートの住所から計算します。"
  ],
  "追加到购物车": [
    "Add to existing cart",
    "既存のカートに追加"
  ],
  "覆盖原购物车": [
    "Replace cart",
    "カートを置換"
  ],
  "取消": [
    "Cancel",
    "キャンセル"
  ],
  "不透视": [
    "Opaque",
    "不透明"
  ],
  "透视": [
    "Transparent",
    "透過"
  ],
  "型材显示方式": [
    "Profile appearance",
    "型材の表示"
  ],
  "型材三维预览": [
    "3D profile preview",
    "型材 3D プレビュー"
  ],
  "重置视角": [
    "Reset view",
    "表示をリセット"
  ],
  "恢复初始角度和大小": [
    "Reset angle and zoom",
    "角度と拡大率をリセット"
  ],
  "框内拖动旋转，滚轮缩放；手机单指旋转、双指缩放。移到框外可滚动聊天。": [
    "Drag to rotate; scroll to zoom. On mobile, drag with one finger and pinch to zoom. Scroll outside the model to browse chat.",
    "枠内でドラッグして回転、ホイールで拡大縮小。スマホは1本指で回転、2本指で拡大縮小。枠外でチャットをスクロールできます。"
  ],
  "橙色为斜切平面示意，请同时核对二维图。": [
    "Orange marks the miter plane. Also check the 2D drawing.",
    "オレンジは斜め切断面の目安です。2D 図もご確認ください。"
  ],
  "3D 预览暂不可用，请先核对下方 ABCD 图和孔位明细。": [
    "3D preview unavailable. Please check the ABCD drawing and hole details.",
    "3D を表示できません。ABCD 図と穴明細をご確認ください。"
  ],
  "保存加工配置": [
    "Save machining",
    "加工を保存"
  ],
  "正在保存…": [
    "Saving…",
    "保存中…"
  ],
  "孔位明细 · 可直接修改或删除": [
    "Hole details · Edit or delete",
    "穴明細・編集または削除"
  ],
  "客户备注": [
    "Customer notes",
    "備考"
  ],
  "例如：客厅左侧立柱 / 玄关右上横梁": [
    "E.g. left upright / upper right beam",
    "例：左側の支柱／右上の横梁"
  ],
  "保存失败，请重试。": [
    "Save failed. Please retry.",
    "保存に失敗しました。再試行してください。"
  ],
  "价格已更新，请在聊天中重新确认报价。": [
    "Prices changed. Please confirm a new quote.",
    "価格が更新されました。見積りを再確認してください。"
  ],
  "购物车暂不可用": [
    "Cart unavailable",
    "カートを利用できません"
  ]
};
export function aiText(language:Language,text:string){return language==='cn'?text:(messages[text]?.[language==='en'?0:1]||text);}
export function useAIText(){const language=useContext(AILanguageContext);return {language,tr:(text:string)=>aiText(language,text)};}
