import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { petApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { NowStation, PageHero } from '../../components/layout/Site.jsx';
import { SittingDog } from '../../components/illust/index.jsx';
import { Button, ConfirmDialog, ErrorState, PageLoader } from '../../components/common/ui.jsx';
import PetFields, { EMPTY_PET, toPetPayload, validatePet } from '../../components/pet/PetFields.jsx';
import { MEMBER_STEPS } from '../auth/Signup.jsx';

/** 반려동물 추가/수정 (마이페이지 [+ 반려동물 추가], 반려동물 카드 클릭) */
export default function PetForm() {
  const { petId } = useParams();
  const isEdit = !!petId;
  const [pet, setPet] = useState(EMPTY_PET);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const { reloadPets } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setLoadError(null);
    petApi
      .get(petId)
      .then((p) => setPet({ ...p, weight: String(p.weight) }))
      .catch(setLoadError)
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (isEdit) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  const errors = submitted ? { ...validatePet(pet), ...serverErrors } : serverErrors;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validatePet(pet)).length) return;
    setSaving(true);
    const { name, breed, weight, gender, neutered, photoUrl } = toPetPayload(pet);
    const payload = { name, breed, weight, gender, neutered, photoUrl };
    try {
      if (isEdit) await petApi.update(petId, payload);
      else await petApi.create(payload);
      await reloadPets();
      toast.show(isEdit ? '반려동물 정보를 수정했어요' : `${name} 등록 완료!`);
      navigate('/mypage', { replace: true });
    } catch (err) {
      if (err.fieldErrors?.length) setServerErrors(err.fieldMap);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (loadError) return <ErrorState error={loadError} onRetry={load} />;

  return (
    <>
      <PageHero line="M" en={isEdit ? 'MY PET' : 'NEW PET'} compact title={isEdit ? `${pet.name} 정보 수정` : '반려동물 추가 등록'} desc="체중은 펫 호텔 객실의 최대 수용 몸무게와 자동으로 비교돼요." art={<SittingDog size={180} />} />
      <NowStation steps={MEMBER_STEPS} current={1} />
      <div className="container">
        <form className="card pet-form" onSubmit={submit} noValidate>
          <PetFields value={pet} onChange={(v) => { setPet(v); setServerErrors({}); }} errors={errors} />
          <div className="pet-form__actions">
            {isEdit && (
              <button type="button" className="btn btn--text" onClick={() => setConfirmDel(true)}>
                이 반려동물 삭제
              </button>
            )}
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              취소
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? '수정 완료' : '등록하기'}
            </Button>
          </div>
        </form>
      </div>
      <ConfirmDialog
        open={confirmDel}
        title={`${pet.name} 정보를 삭제할까요?`}
        desc="삭제 후에는 되돌릴 수 없어요."
        confirmText="삭제"
        onCancel={() => setConfirmDel(false)}
        onConfirm={async () => {
          try {
            await petApi.remove(petId);
            await reloadPets();
            toast.show('삭제했어요');
            navigate('/mypage', { replace: true });
          } catch (err) {
            toast.error(err.message);
            setConfirmDel(false);
          }
        }}
      />
    </>
  );
}
