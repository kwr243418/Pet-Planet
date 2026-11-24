// 공통 UI 컴포넌트 (목업 규칙: 주요 동작 1개만 짙은 초록 채움, 선택은 베이지 바탕 + 흰 알약)
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TinyDog } from '../illust/index.jsx';
import { lineName } from '../../utils/subway.js';

const cx = (...c) => c.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', block, loading, className, children, disabled, ...rest }) {
  return (
    <button className={cx('btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner size={18} light={variant === 'primary'} /> : children}
    </button>
  );
}

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
      <div className="field__row">
        <Tag id={fid} className="field__input" aria-invalid={!!error} aria-describedby={error || hint ? `${fid}-msg` : undefined} maxLength={maxLength} {...rest} />
        {right}
      </div>
      {(error || hint || counter) && (
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
      )}
    </div>
  );
}

export function PasswordField({ hint, onKeyUp, onBlur, ...props }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false); // Caps Lock 경고 (Day 12)
  const checkCaps = (e) => setCaps(!!e.getModifierState?.('CapsLock'));
  return (
    <Field
      {...props}
      hint={caps ? 'Caps Lock이 켜져 있어요' : hint}
      onKeyUp={(e) => {
        checkCaps(e);
        onKeyUp?.(e);
      }}
      onKeyDown={checkCaps}
      onBlur={(e) => {
        setCaps(false);
        onBlur?.(e);
      }}
      type={show ? 'text' : 'password'}
      right={
        <button type="button" className="field__toggle" onClick={() => setShow((s) => !s)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}>
          {show ? '숨기기' : '보기'}
        </button>
      }
    />
  );
}

/**
 * 선택 버튼 그룹: 베이지 바탕 안에 글자만, 선택된 항목만 흰 알약 + 굵은 글씨
 * multiple=true 면 value 는 배열
 */
export function OptionGroup({ options, value, onChange, multiple, label, size = 'md', className }) {
  const isOn = (v) => (multiple ? value.includes(v) : value === v);
  const toggle = (v) => {
    if (!multiple) return onChange(v);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div className={cx('opts', `opts--${size}`, className)} role={multiple ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role={multiple ? undefined : 'radio'}
          aria-checked={multiple ? undefined : isOn(o.value)}
          aria-pressed={multiple ? isOn(o.value) : undefined}
          className={cx('opts__item', isOn(o.value) && 'is-on')}
          onClick={() => toggle(o.value)}
          disabled={o.disabled}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 비밀번호 조건을 입력하는 동안 하나씩 체크 (Day 12) */
export function PasswordRules({ value = '' }) {
  const rules = [
    ['8~20자', value.length >= 8 && value.length <= 20],
    ['영문', /[A-Za-z]/.test(value)],
    ['숫자', /\d/.test(value)],
    ['특수문자', /[^A-Za-z0-9\s]/.test(value)],
  ];
  return (
    <ul className="pw-rules" aria-label="비밀번호 조건">
      {rules.map(([label, ok]) => (
        <li key={label} className={ok ? 'is-ok' : ''}>
          <span aria-hidden>{ok ? '✓' : '·'}</span> {label}
          <span className="sr-only">{ok ? ' 충족' : ' 미충족'}</span>
        </li>
      ))}
    </ul>
  );
}

/** 작은 베이지 칩 (호선·카테고리 표시용, 선택 기능 없음) */
export function Tag({ children, tone = 'beige', className }) {
  return <span className={cx('tag', `tag--${tone}`, className)}>{children}</span>;
}

export const LineChip = ({ line, tone }) => <Tag tone={tone}>{lineName(line)}</Tag>;

/** 별점 표시 — 테라코타 */
export function Stars({ value = 0, size = 16 }) {
  return (
    <span className="stars" style={{ '--star-size': `${size}px` }} aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className="stars__item" aria-hidden>
            <span className="stars__fill" style={{ width: `${fill * 100}%` }}>
              ★
            </span>
            ☆
          </span>
        );
      })}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const labels = ['', '별로예요', '그저 그래요', '괜찮아요', '좋아요', '최고예요'];
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

export function Spinner({ size = 26, light }) {
  return <span className={cx('spinner', light && 'spinner--light')} style={{ width: size, height: size }} aria-label="불러오는 중" />;
}

export function Skeleton({ h = 16, w = '100%', r = 16, style }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

export function PageLoader() {
  return (
    <div className="state state--page">
      <Spinner size={36} />
    </div>
  );
}

export function EmptyState({ title, desc, action, compact }) {
  return (
    <div className={cx('state', compact && 'state--compact')}>
      <TinyDog size={compact ? 56 : 80} />
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
      <TinyDog size={80} mood="sad" />
      <p className="state__title">{offline ? '연결이 끊겼어요' : '문제가 생겼어요'}</p>
      <p className="state__desc">{error?.message ?? '잠시 후 다시 시도해 주세요.'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}

/** 모달 (데스크톱: 가운데 카드 / 모바일: 아래에서 올라오는 시트) */
export function Modal({ open, onClose, title, children, footer, width = 560 }) {
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
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, desc, confirmText = '확인', onConfirm, onCancel, loading }) {
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <p className="dialog__title">{title}</p>
        {desc && <p className="dialog__desc">{desc}</p>}
        <div className="dialog__actions">
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
