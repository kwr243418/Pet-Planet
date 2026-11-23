import { useEffect, useState } from 'react';
import { reviewApi } from '../../api/index.js';
import { REVIEW_MAX, REVIEW_MIN, validateReview } from '../../utils/validators.js';
import { formatDate } from '../../utils/format.js';
import { Button, ConfirmDialog, Field, Modal, StarInput, Stars, Tag } from '../common/ui.jsx';
import { useToast } from '../common/Toast.jsx';
import { focusFirstInvalid } from '../../hooks/usePage.js';

/** 리뷰 카드: 닉네임 · 별점 · 날짜 · 내용, 내 리뷰에만 [수정]·[삭제] */
export function ReviewCard({ review, onEdit, onDelete }) {
  return (
    <article className="review-card">
      <div className="review-card__head">
        <span className="review-card__avatar">{review.userName?.[0] ?? '?'}</span>
        <b className="review-card__name">{review.userName}</b>
        {review.mine && <Tag tone="beige">내 리뷰</Tag>}
        <Stars value={review.rating} size={16} />
      </div>
      <p className="review-card__content">“{review.content}”</p>
      <div className="review-card__foot">
        <span className="faint">{formatDate(review.createdAt)}</span>
        {review.mine && onEdit && (
          <span className="review-card__actions">
            <Button variant="outline" size="sm" onClick={() => onEdit(review)}>
              수정
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(review)}>
              삭제
            </Button>
          </span>
        )}
      </div>
    </article>
  );
}

const QUICK = ['역에서 가까워요', '실내 동반 가능해요', '물그릇을 챙겨줘요', '대형견도 편해요', '사진 찍기 좋아요'];

/** 리뷰 쓰기/수정 모달 — 별점 필수, 10~500자 */
export function ReviewModal({ open, onClose, targetId, targetName, editing, onSaved }) {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const toast = useToast();
  // 작성 중인 내용이 있으면 닫기 전에 확인 (Day 12)
  const dirty = rating !== (editing?.rating ?? 0) || content.trim() !== (editing?.content ?? '').trim();
  const requestClose = () => (dirty && !saving ? setConfirmClose(true) : onClose());

  useEffect(() => {
    if (!open) return;
    setRating(editing?.rating ?? 0);
    setContent(editing?.content ?? '');
    setTouched(false);
    setServerErrors({});
  }, [open, editing]);

  const errors = touched ? { ...validateReview({ rating, content }), ...serverErrors } : {};

  const submit = async () => {
    setTouched(true);
    if (Object.keys(validateReview({ rating, content })).length) {
      focusFirstInvalid(document.querySelector('.modal'));
      return;
    }
    setSaving(true);
    try {
      const saved = editing
        ? await reviewApi.update(editing.reviewId, { rating, content: content.trim() })
        : await reviewApi.create({ targetId, rating, content: content.trim() });
      toast.show(editing ? '리뷰를 수정했어요' : '리뷰를 등록했어요');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e.fieldErrors?.length) setServerErrors(e.fieldMap);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal
      open={open}
      onClose={requestClose}
      title={editing ? '리뷰 수정' : '리뷰 쓰기'}
      footer={
        <>
          <Button variant="outline" onClick={requestClose}>
            취소
          </Button>
          <Button onClick={submit} loading={saving}>
            {editing ? '수정 완료' : '리뷰 등록'}
          </Button>
        </>
      }
    >
      <p className="review-form__target">
        <b>{targetName}</b> 방문은 어떠셨나요?
      </p>
      <StarInput value={rating} onChange={setRating} />
      {errors.rating && <p className="field__error review-form__center">{errors.rating}</p>}
      <div className="review-form__quick">
        {QUICK.map((q) => (
          <button key={q} type="button" className="quick-chip" onClick={() => setContent((c) => (c.includes(q) ? c : `${c}${c && !c.endsWith(' ') ? ' ' : ''}${q}.`).slice(0, REVIEW_MAX))}>
            + {q}
          </button>
        ))}
      </div>
      <Field
        textarea
        label="후기"
        placeholder={`반려동물과 함께한 경험을 알려 주세요 (${REVIEW_MIN}자 이상)`}
        value={content}
        maxLength={REVIEW_MAX}
        counter
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => setTouched(true)}
        error={errors.content}
      />
    </Modal>
    <ConfirmDialog
      open={confirmClose}
      title="작성 중인 리뷰가 있어요"
      desc="지금 닫으면 입력한 내용이 사라져요."
      confirmText="닫기"
      onCancel={() => setConfirmClose(false)}
      onConfirm={() => {
        setConfirmClose(false);
        onClose();
      }}
    />
    </>
  );
}
