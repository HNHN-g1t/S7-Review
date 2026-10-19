import { HyoketsuBurstPreview } from './HyoketsuBurst';
import { HyoketsumeDice } from './HyoketsumeDice';
export function GimmickDicePreview({paused=false}:{paused?:boolean}) {
 return <section className="gimmick-preview">

 <div className="gimmick-concepts">
 <figure><div className="gimmick-sample"><HyoketsumeDice cell={{value:3,kind:'ice'}}/></div><figcaption><b>凍結中</b><p>透明な氷の中にダークブルーのスクエア型メカ爆弾。左上・右上にマイナスネジの目、円形のカウント窓に7セグ表示。凍結中はカウント停止。</p></figcaption></figure>
 <figure><div className="gimmick-sample"><HyoketsumeDice cell={{value:3,kind:'bomb',fuse:6}}/></div><figcaption><b>解凍後</b><p>隣接セヴン目消しで起動。導火線には黄色い火花。6→5→4→3→2→1、その次の手で周囲8マスを爆破。解凍後はセヴン目・ひっさつメでも消えず、カウント終了でのみ爆発します。</p></figcaption></figure>
 </div><p>凍結中は1セルの氷の中で静止し、2秒周期できらめきます。解凍後は拡縮。ひっさつメでは消えません。模擬戦は通常のプレイ画面で、サイの落下・回転・消去・連鎖を使います。コイツメ・ダーメ・ヒョーケツメを配置済み。検討用で本編のステージ配置は未採用です。</p>
 <HyoketsuBurstPreview paused={paused}/>
 </section>;
}
