import { useEffect, useState } from 'react';
import { reviewApi } from '../../api/index.js';
import { REVIEW_MAX, REVIEW_MIN, validateReview } from '../../utils/validators.js';
import { Button, Field, Sheet, StarInput } from '../common/ui.jsx';
import { useToast } from '../common/Toast.jsx';

const QUICK_TAGS = ['물그릇을 챙겨줘요 💧', '대형견도 편해요 🐕', '역에서 가까워요 🚇', '사진 맛집이에요 📸', '사장님이 친절해요 💗'];

/** 리뷰 작성/수정 팝업 (Day 8) — editing 이 있으면 수정 모드 */
export default function ReviewFormSheet({ open, onClose, placeId, placeName, editing, onSaved }) {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setRating(editing?.rating ?? 0);
    setContent(editing?.content ?? '');
    setErrors({});
    setTouched(false);
  }, [open, editing]);

  useEffect(() => {
    if (touched) setErrors(validateReview({ rating, content }));
  }, [rating, content, touched]);

  const submit = async () => {
    setTouched(true);
    const errs = validateReview({ rating, content });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const saved = editing
        ? await reviewApi.update(editing.reviewId, { rating, content: content.trim() })
        : await reviewApi.create({ targetId: placeId, rating, content: content.trim() });
      toast.success(editing ? '리뷰를 수정했어요' : '소중한 리뷰 고마워요!');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e.fieldErrors?.length) setErrors(e.fieldMap);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const len = content.trim().length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? '리뷰 수정하기' : '리뷰 쓰기'}
      footer={
        <Button block onClick={submit} loading={saving}>
          {editing ? '수정 완료' : '리뷰 등록하기'}
        </Button>
      }
    >
      <p className="review-form__place">
        <b>{placeName}</b> 어떠셨나요?
      </p>
      <StarInput value={rating} onChange={setRating} />
      {errors.rating && <p className="field__error center">{errors.rating}</p>}

      <div className="review-form__tags">
        {QUICK_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className="tag tag--btn"
            onClick={() => setContent((c) => (c.includes(t) ? c : `${c}${c && !c.endsWith(' ') ? ' ' : ''}${t}`).slice(0, REVIEW_MAX))}
          >
            {t}
          </button>
        ))}
      </div>

      <Field
        textarea
        label="리뷰 내용"
        placeholder={`우리 아이와 함께한 경험을 알려주세요 (${REVIEW_MIN}자 이상)`}
        value={content}
        maxLength={REVIEW_MAX}
        counter
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => setTouched(true)}
        error={errors.content}
        hint={!errors.content && len >= REVIEW_MIN ? '좋아요! 등록할 수 있어요 ✓' : undefined}
      />
    </Sheet>
  );
}
