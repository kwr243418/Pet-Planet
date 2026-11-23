import { useEffect, useState } from 'react';
import { Button, Field, Modal, StarInput } from '../../components/common/ui.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { REVIEW_MAX, REVIEW_MIN, validateReview } from '../../utils/validators.js';

/** 리뷰 작성 모달 — 별점 필수, 후기 10~500자. onSubmit 이 에러를 던지면 안내만 띄우고 창은 그대로 둬요 */
export default function ReviewFormModal({ open, onClose, targetName, question, onSubmit }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setContent('');
    setTouched(false);
  }, [open]);

  const errors = touched ? validateReview({ rating, content }) : {};

  const submit = async () => {
    setTouched(true);
    if (Object.keys(validateReview({ rating, content })).length) return;
    setSaving(true);
    try {
      await onSubmit({ rating, content: content.trim() });
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="리뷰 쓰기"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit} loading={saving}>
            리뷰 등록
          </Button>
        </>
      }
    >
      <p className="review-form__target">
        <b>{targetName}</b> {question}
      </p>
      <StarInput value={rating} onChange={setRating} />
      {errors.rating && <p className="field__error review-form__center">{errors.rating}</p>}
      <Field
        textarea
        label="후기"
        placeholder={`경험을 알려 주세요 (${REVIEW_MIN}자 이상)`}
        value={content}
        maxLength={REVIEW_MAX}
        counter
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => setTouched(true)}
        error={errors.content}
      />
    </Modal>
  );
}