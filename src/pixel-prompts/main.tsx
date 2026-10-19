import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { defaults, exportText, generatePrompts, presets, validate } from './model';
import type { PromptPair, Settings } from './model';
import './styles.css';

type Reference = { url: string; name: string; width: number; height: number };
const motionSuggestions: Record<string, string> = { '待機': '小さな呼吸と自然なまばたき', '歩行': 'その場で歩く。腕と脚を交互に動かす', '走行': 'その場で走る。腕と脚を交互に大きく動かす', 'ジャンプ': 'その場で軽くしゃがみ、跳び上がって同じ接地点へ着地する', '攻撃': '短く構え、1回攻撃して基準姿勢に戻る', '喜ぶ': '両腕を上げて喜び、基準姿勢に戻る', 'その他': '' };

function App() {
  const [settings, setSettings] = useState<Settings>({ ...defaults });
  const [reference, setReference] = useState<Reference | null>(null);
  const [imageError, setImageError] = useState('');
  const [fit, setFit] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pairs, setPairs] = useState<PromptPair[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  const version = useRef(0);
  const pendingUrl = useRef<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (reference) URL.revokeObjectURL(reference.url); }, [reference]);
  useEffect(() => () => {
    version.current += 1;
    if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
    clearTimeout(timer.current);
  }, []);
  useEffect(() => { if (manualCopy) { dialogRef.current?.showModal(); copyRef.current?.focus(); copyRef.current?.select(); } }, [manualCopy]);

  function flash(text: string) {
    clearTimeout(timer.current);
    setNotice(text);
    timer.current = setTimeout(() => setNotice(''), 4500);
  }
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(old => ({ ...old, [key]: value }));
    setDirty(true);
    setError('');
  }
  function toggle(key: 'selected' | 'features', value: string) {
    update(key, settings[key].includes(value) ? settings[key].filter(v => v !== value) : [...settings[key], value]);
  }
  function changeAction(action: string) {
    setSettings(old => ({ ...old, action, motion: Object.values(motionSuggestions).includes(old.motion) ? motionSuggestions[action] : old.motion }));
    setDirty(true);
    setError('');
  }
  function clearImage() {
    version.current += 1;
    if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
    pendingUrl.current = null;
    setReference(null);
    setImageError('');
    setDirty(true);
    if (upload.current) upload.current.value = '';
  }
  function loadImage(file?: File) {
    if (!file) return;
    if (upload.current) upload.current.value = '';
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { setImageError('PNG・JPEG・WebP・GIFを選んでください。'); return; }
    if (file.size > 20 * 1024 * 1024) { setImageError('画像は20MB以下にしてください。'); return; }
    const request = ++version.current;
    if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
    const url = URL.createObjectURL(file);
    pendingUrl.current = url;
    const img = new Image();
    img.onload = () => {
      if (request !== version.current) { URL.revokeObjectURL(url); return; }
      pendingUrl.current = null;
      setReference({ url, name: file.name, width: img.naturalWidth, height: img.naturalHeight });
      setImageError(''); setDirty(true); setFit(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (request === version.current) { pendingUrl.current = null; setImageError('画像を読み込めませんでした。別の画像を選んでください。'); }
    };
    img.src = url;
  }
  function generate() {
    const problem = validate(settings);
    if (problem) { setError(problem); return; }
    setPairs(generatePrompts(settings, reference?.name));
    setDirty(false); setError('');
    flash(`${settings.selected.length}画風のプロンプトを作成しました`);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash('コピーしました');
    } catch {
      setManualCopy(text);
    }
  }
  function save() {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + exportText(pairs)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'pixel-prompts.txt';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash('テキストの保存を開始しました');
  }

  return <>
    <header className="topbar"><a className="brand" href="./pixel-prompts.html"><span className="pixel-mark" aria-hidden="true">▦</span> DOT / PROMPT</a><span className="local-badge"><i /> 端末内で処理</span><a className="review-link" href="./review.html">確認サイト ↗</a></header>
    <main>
      <div className="intro"><div><p className="eyebrow">REFERENCE → PIXEL ART → ANIMATION</p><h1>ドット絵プロンプト工房<span>参照画像の「らしさ」を、次のコマへ。</span></h1><p className="lede">画風を選んで、基準の1枚と連番アニメの指示をまとめて作成。</p></div><div className="intro-note"><b>画像生成・外部送信なし</b><span>APIキー不要 / プロンプト作成のみ</span></div></div>
      <div className="workspace">
        <aside className="reference-panel panel">
          <div className="section-title"><span className="step">01</span><h2>参照画像</h2><span className="optional">任意</span></div>
          <input ref={upload} type="file" id="reference-file" accept="image/png,image/jpeg,image/webp,image/gif" className="visually-hidden" onChange={e => loadImage(e.target.files?.[0])} />
          <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); loadImage(e.dataTransfer.files[0]); }}>
            {reference ? <div className={`image-stage ${fit ? 'fit' : ''}`}><img src={reference.url} alt="アップロードした参照画像（未加工）" style={fit ? undefined : { width: reference.width, height: reference.height }} /></div> : <label className="empty-image" htmlFor="reference-file"><span className="upload-icon" aria-hidden="true">＋</span><strong>画像を選択</strong><span>または、ここにドロップ</span><small>PNG / JPEG / WebP / GIF · 20MBまで</small></label>}
          </div>
          {reference ? <><div className="image-meta"><strong title={reference.name}>{reference.name}</strong><span>{reference.width} × {reference.height}px</span></div><div className="preview-actions"><button type="button" aria-pressed={!fit} onClick={() => setFit(false)}>原寸 1:1</button><button type="button" aria-pressed={fit} onClick={() => setFit(true)}>全体表示</button><button type="button" onClick={() => upload.current?.click()}>変更</button><button type="button" onClick={clearImage}>削除</button></div></> : null}
          {imageError && <p role="alert" className="error">{imageError}</p>}
          <p className="hint">未加工の参照画像です。原寸表示はスクロールできます。画像の解析やドット変換は行いません。</p>
          <div className="reference-features"><h3>元絵から維持する特徴</h3><div className="feature-list">{defaults.features.map(feature => <label key={feature}><input type="checkbox" checked={settings.features.includes(feature)} onChange={() => toggle('features', feature)} />{feature}</label>)}</div><label className="field">特徴・追加指定<textarea rows={4} maxLength={2000} value={settings.notes} onChange={e => update('notes', e.target.value)} placeholder="例：丸い目、左耳の欠け、青いマフラー。目の形と頭身を最優先。" /></label></div>
          <p className="privacy-note">選んだ画像はこのページのメモリ内だけで扱います。再読み込みで消えます。生成AIへは、ユーザー自身で画像を添付してください。</p>
        </aside>
        <div className="settings-column">
          <section className="panel">
            <div className="section-title"><span className="step">02</span><h2>画風を選ぶ</h2><span className="optional">複数選択</span></div>
            <div className="presets">{presets.map(p => <label className={`preset ${settings.selected.includes(p.id) ? 'selected' : ''}`} key={p.id}><div className="preset-top"><span>{p.label}</span><input type="checkbox" checked={settings.selected.includes(p.id)} onChange={() => toggle('selected', p.id)} /></div><strong>{p.name}</strong><p>{p.description}</p><small>{p.colors}色 / {p.size}×{p.size}px / 陰影{p.shades}段</small></label>)}</div>
            <p className="bit-note"><b>8bit / 16bit / 32bit はハード世代のイメージです。</b>色数や画素サイズとは別の指定です。ファミコン風を含め、実機制約の厳密な再現ではありません。</p>
          </section>
          <section className="panel">
            <div className="section-title"><span className="step">03</span><h2>ドットの条件</h2><span className="optional">空欄・自動は画風の推奨値</span></div>
            <div className="fields-grid">
              <label className="field">最大色数 <span>透明は別枠 / 2〜256色</span><input type="number" min="2" max="256" step="1" placeholder="画風に合わせる" value={settings.colors} onChange={e => update('colors', e.target.value)} /></label>
              <div className="field"><span className="field-label">基準ピクセル寸法 <span>各16〜512px</span></span><div className="dimensions"><input aria-label="基準幅" type="number" min="16" max="512" placeholder="幅：自動" value={settings.width} onChange={e => update('width', e.target.value)} /><span>×</span><input aria-label="基準高さ" type="number" min="16" max="512" placeholder="高さ：自動" value={settings.height} onChange={e => update('height', e.target.value)} /></div></div>
              <label className="field">陰影段数 <span>基本色を含む / 1〜8段</span><input type="number" min="1" max="8" placeholder="画風に合わせる" value={settings.shades} onChange={e => update('shades', e.target.value)} /></label>
              <label className="field">輪郭<select aria-label="輪郭" value={settings.outline} onChange={e => update('outline', e.target.value)}><option value="">自動：画風に合わせる</option><option>暗色の1px輪郭</option><option>部位の色に合わせた1px輪郭</option><option>輪郭線なし（色面で形を分ける）</option></select></label>
              <label className="field">ディザリング<select aria-label="ディザリング" value={settings.dither} onChange={e => update('dither', e.target.value)}><option value="">自動：画風に合わせる</option><option value="使わない">なし</option><option value="陰影境界に限定した規則的なディザリング">控えめな規則的パターン</option></select></label>
              <label className="check-field"><input type="checkbox" checked={settings.transparent} onChange={e => update('transparent', e.target.checked)} /><span>背景を透明にする<small>OFFなら単色の白背景</small></span></label>
            </div>
            <p className="hint">上書きした値は、選んだ全画風に共通で反映します。色数は輪郭・陰影を含む全体の上限です。</p>
          </section>
          <section className="panel animation-panel">
            <div className="section-title"><span className="step">04</span><h2>アニメの条件</h2></div>
            <div className="animation-fields"><label className="field">動作<select aria-label="動作" value={settings.action} onChange={e => changeAction(e.target.value)}>{Object.keys(motionSuggestions).map(a => <option key={a}>{a}</option>)}</select></label><label className="field">コマ数<input type="number" min="2" max="32" value={settings.frames} onChange={e => update('frames', e.target.value)} /></label><label className="field">FPS<input type="number" min="1" max="30" value={settings.fps} onChange={e => update('fps', e.target.value)} /></label><label className="check-field"><input type="checkbox" checked={settings.loop} onChange={e => update('loop', e.target.checked)} />ループ</label></div>
            <label className="field motion-field">動きの詳細<input maxLength={1000} value={settings.motion} placeholder="例：その場で歩く。腕と脚を交互に動かす。" onChange={e => update('motion', e.target.value)} /></label>
          </section>
          <div className="generate-bar"><p><b>{settings.selected.length}画風 × 2プロンプト</b><span>基準画像 → 確定画像を再添付 → 連番</span></p><button type="button" className="primary" onClick={generate}>まとめて作成 <span aria-hidden="true">↓</span></button></div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </div>
      <section className="results" ref={resultRef} aria-labelledby="results-title">
        <div className="results-heading"><div><p className="eyebrow">PROMPT OUTPUT</p><h2 id="results-title">生成プロンプト {pairs.length > 0 && <span>{pairs.length}画風</span>}</h2></div><div className="output-actions"><button disabled={!pairs.length || dirty} onClick={() => copy(exportText(pairs))}>すべてコピー</button><button disabled={!pairs.length || dirty} onClick={save}>テキスト保存 ↓</button></div></div>
        {dirty && pairs.length > 0 && <p className="stale" role="status">設定を変更しました。「まとめて作成」で出力を更新してください。コピーと保存は更新後に使えます。</p>}
        {!pairs.length ? <div className="results-empty"><span aria-hidden="true">▤</span><p>設定を選んで「まとめて作成」。<br />画風ごとに2つのプロンプトが並びます。</p></div> : <div className="prompt-results">{pairs.map(pair => <article className="prompt-pair" key={pair.id}><div className="pair-heading"><h3>{pair.title}</h3><span>{pair.summary}</span></div><div className="prompt-grid">{([{ key: 'base', number: 'A', title: '基準の1枚', hint: '元の参照画像を添付' }, { key: 'animation', number: 'B', title: '連番アニメ', hint: '確定済み基準画像を再添付' }] as const).map(item => <div className="prompt" key={item.key}><div className="prompt-heading"><div><h4><span>{item.number}</span>{item.title}</h4><p>{item.hint}</p></div><button disabled={dirty} onClick={() => copy(pair[item.key])} aria-label={`${pair.title} ${item.title}をコピー`}>コピー</button></div><textarea readOnly aria-label={`${pair.title} ${item.title}のプロンプト`} value={pair[item.key]} rows={13} /></div>)}</div></article>)}</div>}
      </section>
      <footer><b>生成結果には確認と修正が必要です。</b><p>AIによる元絵への忠実性・厳密なドット表現・コマ間の一致は保証されません。このツールはプロンプトを組み立てるもので、画像生成APIを呼びません。</p></footer>
    </main>
    <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
    {manualCopy && <dialog ref={dialogRef} onCancel={() => setManualCopy('')} aria-labelledby="copy-title" className="copy-dialog"><h2 id="copy-title">テキストを手動でコピー</h2><p>クリップボードが許可されていません。選択済みのテキストを Ctrl+C / ⌘C、または長押しでコピーしてください。</p><textarea ref={copyRef} readOnly value={manualCopy} rows={10} aria-label="手動コピー用テキスト" /><button className="primary" onClick={() => setManualCopy('')}>閉じる</button></dialog>}
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
