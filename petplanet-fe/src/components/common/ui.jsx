// 공통 UI 컴포넌트 모음 (Day 1 "공통 UI 라이브러리")
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Mascot from './Mascot.jsx';
import { lineInfo } from '../../utils/subway.js';

const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------- Button ---------- */
export function Button({ variant = 'primary', size = 'lg', block, loading, className, children, disabled, ...rest }) {
  return (
    <button
      className={cx('btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={18} light={variant === 'primary'} /> : children}
    </button>
  );
}

/* ---------- Text field ---------- */
export function Field({ label, error, hint, right, className, id, textarea, counter, maxLength, ...rest }) {
  const autoId = useId();
  const fid = id ?? autoId;
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <div className={cx('field', error && 'field--error', className)}>
      {label && (
        <label className="field__label" htmlFor={fid}>
          {label}
        </label>
      )}
      <div className="field__box">
        <Tag
          id={fid}
          className="field__input"
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${fid}-msg` : undefined}
          maxLength={maxLength}
          {...rest}
        />
        {right && <div className="field__right">{right}</div>}
      </div>
      <div className="field__foot">
        {(error || hint) && (
          <p id={`${fid}-msg`} className={error ? 'field__error' : 'field__hint'}>
            {error || hint}
          </p>
        )}
        {counter && (
          <span className="field__counter">
            {String(rest.value ?? '').length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

export function PasswordField(props) {
  const [show, setShow] = useState(false);
  return (
    <Field
      {...props}
      type={show ? 'text' : 'password'}
      right={
        <button type="button" className="icon-btn icon-btn--sm" onClick={() => setShow((s) => !s)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}>
          {show ? '🙈' : '👀'}
        </button>
      }
    />
  );
}

/* ---------- Chip (토글 가능한 필터 칩) ---------- */
export function Chip({ active, onClick, children, color, className, ...rest }) {
  return (
    <button
      type="button"
      className={cx('chip', active && 'chip--active', className)}
      aria-pressed={active}
      onClick={onClick}
      style={active && color ? { background: color, borderColor: color } : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- 지하철 호선 배지 ---------- */
export function LineBadge({ code, small }) {
  const l = lineInfo(code);
  return (
    <span className={cx('line-badge', small && 'line-badge--sm', l.short.length > 1 && 'line-badge--wide')} style={{ background: l.color }} title={l.name}>
      {l.short}
    </span>
  );
}

/* ---------- 별점 (표시/입력) ---------- */
export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="stars" style={{ '--star-size': `${size}px` }} aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className="stars__item">
            <span className="stars__fill" style={{ width: `${fill * 100}%` }}>
              ★
            </span>
            ★
          </span>
        );
      })}
    </span>
  );
}

export function StarInput({ value, onChange, size = 36 }) {
  const [hover, setHover] = useState(0);
  const labels = ['', '별로예요', '그저 그래요', '괜찮아요', '좋아요', '최고예요!'];
  const shown = hover || value;
  return (
    <div className="star-input">
      <div role="radiogroup" aria-label="별점 선택" className="star-input__row" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i}점`}
            className={cx('star-input__star', i <= shown && 'is-on')}
            style={{ fontSize: size }}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
          >
            ★
          </button>
        ))}
      </div>
      <p className="star-input__label">{shown ? labels[shown] : '별을 눌러 평가해 주세요'}</p>
    </div>
  );
}

/* ---------- Spinner / Skeleton ---------- */
export function Spinner({ size = 28, light }) {
  return <span className={cx('spinner', light && 'spinner--light')} style={{ width: size, height: size }} aria-label="불러오는 중" />;
}

export function PageLoader({ text = '불러오는 중이에요…' }) {
  return (
    <div className="state">
      <Mascot size={88} className="bob" />
      <p className="state__desc">{text}</p>
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 8, style }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

/* ---------- 빈 화면 / 에러 화면 ---------- */
export function EmptyState({ title, desc, action, mood = 'sleepy' }) {
  return (
    <div className="state">
      <Mascot size={96} mood={mood} />
      <p className="state__title">{title}</p>
      {desc && <p className="state__desc">{desc}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const offline = error?.status === 0;
  return (
    <div className="state" role="alert">
      <Mascot size={96} mood="sad" />
      <p className="state__title">{offline ? '연결이 끊겼어요' : '앗, 문제가 생겼어요'}</p>
      <p className="state__desc">{error?.message ?? '잠시 후 다시 시도해 주세요.'}</p>
      {onRetry && (
        <Button variant="outline" size="md" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}

/* ---------- Modal / Bottom sheet ---------- */
export function Sheet({ open, onClose, title, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet__grab" />
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, desc, confirmText = '확인', danger, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop sheet-backdrop--center" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <Mascot size={64} mood={danger ? 'sad' : 'happy'} />
        <p className="dialog__title">{title}</p>
        {desc && <p className="dialog__desc">{desc}</p>}
        <div className="dialog__actions">
          <Button variant="ghost" size="md" onClick={onCancel}>
            취소
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="md" onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Segmented toggle ---------- */
export function Segmented({ options, value, onChange, name }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={cx('segmented__item', value === o.value && 'is-on')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
