import { CAMPAIGN_MISSIONS, type WallAbility } from './story/wall1';
export type SkillEntry = {
  id: string; name: string; short: string; category: string; condition: string; effect: string; tip: string;
  diagram: string[]; caption: string; ability?: WallAbility; practiceUrl?: string; status?: string;
};
// 新しい技はこの配列へ1件追加。図鑑の目次・一覧・模擬戦の選択へ自動反映する。
// 図：1〜6=出目、n=ニコニコメ、h=氷、b=起動した爆弾、*=効果範囲、.=空き。
export const SKILL_ENTRIES: SkillEntry[] = [
 {id:'you456',name:'456You!',short:'456You!',category:'なぞる・ツラヌキ',practiceUrl:'/enemy-practice.html?enemy=koitsume&skill=you456',condition:'上下左右でつながった4→5→6が発光。4から指やマウスを離さず順になぞって発動。',effect:'起点の4から十字方向へ、縦1列・横1行を盤面の端までつらぬく。FEVER中は起点に隣接する列・行も加えて縦2列・横2行。',tip:'なぞった4・5・6も消える。並びを飛ばす・逆戻り・途中で離すと中断。端ではFEVERの追加ラインが内側に出る。',diagram:['..*....','..*....','**456**','..*....','..*....'],caption:'4が起点。上下左右の十字ラインが盤面端まで貫く'},
 {id:'spa1',name:'スーパー1',short:'スパ1',category:'つなげる',ability:'spa1',condition:'1の目を上下左右に5つ以上つなげる。',effect:'つながった1の目が消える。7つ以上でスコア2倍。',tip:'一直線でなくてもOK。かたまりで5つを作れる。',diagram:['.......','..11...','..111..','.......','.......'],caption:'1が5つ、上下左右でつながった成立例'},
 {id:'sla3',name:'スラッシュ3',short:'スラ3',category:'ツラヌキ',ability:'sla3',condition:'3の目を斜めに3つ以上並べる。',effect:'そろえた斜めのラインを盤面の端までつらぬく。',tip:'右上がり・左上がりの両方に対応。目を狙う攻撃にも使う。',diagram:['.....*.','....3..','...3...','..3....','.*.....'],caption:'斜め3つ＋同じ斜めラインの効果方向'},
 {id:'squ4',name:'スクウェア4',short:'スク4',category:'四角',ability:'squ4',condition:'4の目で2×2の正方形を作る。',effect:'2×2の4と、そこから上下左右につながる4をまとめて消す。',tip:'四角につながる4を増やして大きく消そう。',diagram:['.......','..44...','..444..','.......','.......'],caption:'2×2の本体＋右につながる4'},
 {id:'str6',name:'ストレイト6',short:'スト6',category:'ツラヌキ',ability:'str6',condition:'6の目を縦か横に4つ以上並べる。',effect:'そろえた縦・横のラインを盤面の端までつらぬく。',tip:'名前の6は出目。必要な数は4つ以上。',diagram:['.......','.......','*6666**','.......','.......'],caption:'横に6が4つ＋左右へのツラヌキ'},
 {id:'nico',name:'ニコニコボム',short:'ニコボム',category:'ボム',ability:'nico',condition:'ニコニコメを上下左右に2つ以上つなげる。',effect:'つながったニコニコメと盤面全体の2・5を消す。離れた単独のニコニコメも自身と周囲8マスを巻き込む。',tip:'黒地に白い点で2と5を交互に表示。静止図はその2状態。ほかの技の消去では残る。',diagram:['.2...5.','...2...','..nn...','...5...','.5...2.'],caption:'中央でニコニコメを接続→離れた2・5にも効果'},
 {id:'fever',name:'FEVER',short:'フィーバー',category:'強化状態',ability:'fever',condition:'消去・連鎖でFEVERゲージをためて突入。',effect:'ひっさつメの消去範囲が周囲1マス分広がる。イチニノサンダーは2列から4列へ強化。',tip:'技そのものではなく、技を強化する状態として併記。',diagram:['.......','.****..','.*44*..','.*44*..','.****..'],caption:'スク4の周囲1マスまで効果が広がる例'},
 {id:'rainbow',name:'虹ボム',short:'虹ボム',category:'救済ボム',ability:'rainbow',condition:'所持しているとき、ゲームオーバーの直前に使用を選ぶ。',effect:'盤面の上から9段を消して立て直す。',tip:'模擬戦ボタンでは既存の虹ボム習得ステージで使用を確認。',diagram:['*******','*******','*******','*******','*******','*******','*******','*******','*******','.......','.......','.......','.......','.......'],caption:'7×14盤面の上9段が対象'},
 {id:'thunder',name:'イチニノサンダー',short:'サンダー',category:'なぞる',ability:'thunder',condition:'上下左右でつながった1→2→3を、指を離さず順になぞる。',effect:'通常時は離れたランダム2列に雷。FEVER中は4列に増える。なぞった1・2・3も消える。',tip:'発動後の落雷先はランダム。画面の光る1・2・3をなぞろう。',diagram:['.*...*.','.*...*.','.*...*.','.*...*.','.123...'],caption:'1→2→3の入力例と、ランダム2列の落雷例'},
 {id:'hyoketsu',name:'ヒョーケツボム',short:'ヒョーケツ',category:'時限ギミック',status:'検討用',practiceUrl:'/enemy-practice.html?enemy=hyoketsume',condition:'ヒョーケツメの氷に隣接するセヴン目消しで解凍。',effect:'解凍した手は6を保持。その後6→5→4→3→2→1、次の設置手で自身と周囲8マスを爆破。周囲8セルを左回りに1000msで凍結し、400msの斜めライトスイープ、600msの氷クラッシュ。',tip:'セヴン目・ひっさつメ・他の爆風では消えず、自身の爆発まで残る。',diagram:['.......','..***..','..*b*..','..***..','.......'],caption:'解凍後の時限爆発：中心と周囲8マス'},
 {id:'enjo',name:'エンジョーボム',short:'エンジョー',category:'炎・投下ボム',status:'デザイン検討',practiceUrl:'/enemy-practice.html?enemy=enjo',condition:'炎本体は縦2セル。黒いカプセル壁は2段または3段。隣接セヴン目で全段（3段時は上→中→下）を解除して初めてタップ可能。壁がなくなった炎の本体をタップすると上空へ移動・待機し、次のサイ落下で発動。',effect:'素早く自動落下し最下段へ着弾。下から7・5・3・1セルのピラミッド範囲にある敵・ボムをすべて破壊。FEVER中は9・7・5・3・1セルへ拡大。',tip:'図鑑デモに加えて実プレイ模擬戦で確認。通常16セル、FEVERは最大25セル（7列盤では盤外を除き23セル）。壁2段/3段・通常/FEVERを切り替え可能。',diagram:['...*...','..***..','.*****.','*******'],caption:'通常：下から7→5→3→1。縦2セルの投下式ボム'},
];
export function skillPracticeUrl(entry: SkillEntry): string {
 if(entry.practiceUrl)return entry.practiceUrl;
 const mission=CAMPAIGN_MISSIONS.find(m=>m.learns===entry.ability);
 if(!mission)throw new Error('お手本ステージが未設定: '+entry.id);
 return '/review-game.html?review=story&stage='+mission.stage;
}
