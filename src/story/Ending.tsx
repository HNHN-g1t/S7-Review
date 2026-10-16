import { useEffect, useState } from 'react';
import './ending.css';

// エンディング（2026-10-14・ラフ）。9-3（王座の主）を倒したあと、またはマップの王座から見られる。
// 紙芝居3枚 → エンドロール → THE END。絵はあとで差し替える前提の仮の図形と、いまある顔の絵だけで組んでいる。
// 紙芝居の文と絵の差し替え先：PANELS の text と art（public/images/ending-1〜3.webp などを置いて img にする想定）

type Panel = { title: string; text: string; art: 'throne' | 'return' | 'meadow' | 'abyss' | 'light' | 'both' };

const PANELS: Panel[] = [
  {
    title: 'その一　王座の間',
    text: '王座の主をたおすと、城じゅうのサイリアンが\n光のつぶになって、天井へと消えていった。',
    art: 'throne',
  },
  {
    title: 'その二　とりもどしたチカラ',
    text: 'うばわれていたひっさつメのチカラが、\nひとつ、またひとつと、サイノメたちのもとへ帰ってくる。',
    art: 'return',
  },
  {
    title: 'その三　ただいま',
    text: 'サイカ「ただいま、サイノメ草原！」\nとなり合うメは、きょうも7をつくっている。',
    art: 'meadow',
  },
];

// ウラエンディング（2026-10-14・ラフ）。ウラ1-3（ウラの底）を倒したあと、またはウラ1の門から
const URA_PANELS: Panel[] = [
  {
    title: 'ウラその一　ウラの底',
    text: 'まっ黒な世界のいちばん底で、\nサイカは、目のない黒いサイを見つけた。',
    art: 'abyss',
  },
  {
    title: 'ウラその二　七つの光',
    text: 'となり合うメが7をつくるたび、\n黒いサイに、ひとつずつ光の目がもどっていく。',
    art: 'light',
  },
  {
    title: 'ウラその三　オモテとウラ',
    text: 'サイカ「オモテもウラも、ぜんぶ足して7！」\nこれで、ほんとうにおしまい。',
    art: 'both',
  },
];

// エンドロール（2026-10-14 クレジット確定）
const CREDITS: Array<{ role: string; names: string[] }> = [
  { role: 'サイノメ・セヴン', names: [] },
  { role: 'キャラクター', names: ['サイカ', 'ゾロメ仙人', 'サイノメたち（イチノメ〜ムッツメ）'] },
  { role: 'サイリアン', names: ['コイツメ', 'ダーメ', 'ヒドイメ', 'ベラボウメ', 'デタラメ', 'アンチクショウメ', 'サンザッパラナメ'] },
  { role: 'ディレクター', names: ['pAm（にんげん）'] },
  { role: 'イラスト', names: ['ロポ（ChatGPT）'] },
  { role: 'プログラム', names: ['くぅちゃん（Claude）'] },
  { role: '音楽', names: ['ユキ（SUNO）'] },
  { role: 'スペシャルサンクス', names: ['遊んでくれたあなた'] },
];

export function Ending({ onClose, onSeen, variant = 'omote' }: { onClose: () => void; onSeen?: () => void; variant?: 'omote' | 'ura' }) {
  const [page, setPage] = useState(0); // 0〜2：紙芝居、3：エンドロール、4：THE END
  const next = () => setPage((value) => Math.min(value + 1, 4));
  const panels = variant === 'ura' ? URA_PANELS : PANELS;
  // エンドロールの最後（THE END）まで見たら「見た」印を立てる（王座に「？？？」が出る）
  useEffect(() => { if (page === 4) onSeen?.(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // エンドロールは流れ終わったら THE END へ（タップで飛ばせる）
  useEffect(() => {
    if (page !== 3) return;
    const timer = window.setTimeout(() => setPage(4), 26000);
    return () => window.clearTimeout(timer);
  }, [page]);

  return (
    <section className={`ending-screen ${variant === 'ura' ? 'is-ura' : ''}`} aria-label={variant === 'ura' ? 'ウラエンディング' : 'エンディング'} onClick={page < 4 ? next : undefined}>
      {page < 3 ? (
        <div className="ending-panel" key={page}>
          <div className={`ending-art is-${panels[page].art}`} aria-hidden>
            <EndingArt kind={panels[page].art} />
          </div>
          <h2>{panels[page].title}</h2>
          <p>{panels[page].text}</p>
          <small className="ending-hint">タップで次へ　{page + 1}/3</small>
        </div>
      ) : page === 3 ? (
        <div className="ending-roll" aria-live="off">
          <div className="ending-roll-track">
            {CREDITS.map((credit) => (
              <div className="ending-credit" key={credit.role}>
                <h3>{credit.role}</h3>
                {credit.names.map((name) => <p key={name}>{name}</p>)}
              </div>
            ))}
            <div className="ending-credit is-last"><h3>おわり</h3></div>
          </div>
          <small className="ending-hint">タップでとばす</small>
        </div>
      ) : (
        <div className="ending-fin">
          <b>{variant === 'ura' ? 'TRUE END' : 'THE END'}</b>
          <p>{variant === 'ura' ? 'ウラまで遊んでくれて、ほんとうにありがとう！' : 'ここまで遊んでくれて、ありがとう！'}</p>
          <button type="button" onClick={onClose}>タイトルへ</button>
        </div>
      )}
    </section>
  );
}

// 紙芝居の仮の絵。あとで1枚絵に差し替えるので、構図だけ分かる図形にしている
function EndingArt({ kind }: { kind: Panel['art'] }) {
  if (kind === 'abyss') {
    return (
      <>
        <i className="ea-dark-die" />
        <img className="ea-saika is-small" src="/images/saika-02.png" alt="" />
      </>
    );
  }
  if (kind === 'light') {
    return (
      <>
        <i className="ea-dark-die is-center" />
        {Array.from({ length: 7 }, (_, i) => <i className="ea-eye-light" key={i} style={{ '--i': i } as React.CSSProperties} />)}
      </>
    );
  }
  if (kind === 'both') {
    return (
      <>
        <i className="ea-half-light" />
        <i className="ea-half-dark" />
        <img className="ea-saika is-center" src="/images/saika-11.png" alt="" />
      </>
    );
  }
  if (kind === 'throne') {
    return (
      <>
        <i className="ea-floor" />
        <i className="ea-throne" />
        {Array.from({ length: 14 }, (_, i) => <i className="ea-spark" key={i} style={{ '--i': i } as React.CSSProperties} />)}
        <img className="ea-saika" src="/images/saika-03.png" alt="" />
      </>
    );
  }
  if (kind === 'return') {
    return (
      <>
        {['1', '3', '4', '6', '☺', 'F', '虹', '⚡'].map((mark, i) => (
          <i className="ea-power" key={mark} style={{ '--i': i } as React.CSSProperties}>{mark}</i>
        ))}
        <img className="ea-saika is-center" src="/images/saika-01.png" alt="" />
      </>
    );
  }
  return (
    <>
      <i className="ea-sky" />
      <i className="ea-hill" />
      <img className="ea-saika is-wave" src="/images/saika-10.png" alt="" />
      <img className="ea-sage" src="/zorome/z01.png" alt="" />
    </>
  );
}

// 「？？？」を押したあと：足もとが抜けて、サイカが黒い世界へ落ちていく（約2.6秒・タップで飛ばせる）
export function UraFall({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="ura-fall" aria-label="ウラメンへ" onClick={onDone}>
      <p className="ura-fall-line">……あれ？ 足もとが……！</p>
      <img className="ura-fall-saika" src="/images/saika-02.png" alt="" />
      <b className="ura-fall-title">ウラメン</b>
    </section>
  );
}
