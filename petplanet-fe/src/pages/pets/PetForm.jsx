import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { petApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import Header from '../../components/common/Header.jsx';
import Mascot from '../../components/common/Mascot.jsx';
import { Button, ConfirmDialog, ErrorState, Field, PageLoader, Segmented } from '../../components/common/ui.jsx';
import { runValidators, validateBreed, validatePetName, validateWeight } from '../../utils/validators.js';
import { SIZE_LABEL, sizeFromWeight } from '../../utils/format.js';

const BREEDS = ['말티즈', '푸들', '포메라니안', '비숑 프리제', '시츄', '치와와', '웰시코기', '진돗개', '시바견', '골든 리트리버', '래브라도 리트리버', '보더콜리', '닥스훈트', '프렌치 불독', '믹스'];

const RULES = { name: validatePetName, breed: validateBreed, weight: validateWeight };
const EMPTY = { name: '', breed: '', weight: '', gender: 'F', neutered: false };

/** 반려동물 프로필 등록/수정 (Day 3) — /pets/new, /pets/:petId/edit */
export default function PetForm() {
  const { petId } = useParams();
  const isEdit = !!petId;
  const [params] = useSearchParams();
  const fromSignup = params.get('from') === 'signup';
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
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
      .then((p) => setForm({ name: p.name, breed: p.breed, weight: String(p.weight), gender: p.gender, neutered: p.neutered }))
      .catch(setLoadError)
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (isEdit) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  const errors = { ...runValidators(form, RULES), ...serverErrors };
  const show = (k) => (touched[k] ? errors[k] : '');
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors((s) => ({ ...s, [k]: undefined }));
  };
  const size = sizeFromWeight(form.weight);

  const done = () => {
    const redirect = params.get('redirect');
    navigate(fromSignup ? redirect || '/' : '/mypage', { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, breed: true, weight: true });
    if (Object.values(runValidators(form, RULES)).some(Boolean)) return;
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), breed: form.breed.trim(), weight: Number(form.weight) };
    try {
      if (isEdit) await petApi.update(petId, payload);
      else await petApi.create(payload);
      await reloadPets();
      toast.success(isEdit ? '프로필을 수정했어요' : `${payload.name} 등록 완료! 🐶`);
      done();
    } catch (err) {
      if (err.fieldErrors?.length) setServerErrors(err.fieldMap);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await petApi.remove(petId);
      await reloadPets();
      toast.success('프로필을 삭제했어요');
      navigate('/mypage', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setConfirmDel(false);
    }
  };

  if (loading) return <PageLoader />;
  if (loadError)
    return (
      <div className="page page--no-nav">
        <Header back title="반려동물 정보" />
        <ErrorState error={loadError} onRetry={load} />
      </div>
    );

  return (
    <div className="page page--no-nav">
      <Header
        back={!fromSignup}
        title={isEdit ? '프로필 수정' : '반려동물 등록'}
        right={fromSignup && <button className="btn btn--text" onClick={done}>나중에 할게요</button>}
      />

      <div className="pet-hero">
        <div className="pet-hero__avatar">
          <Mascot size={96} mood={form.name ? 'love' : 'happy'} />
        </div>
        <p className="pet-hero__name cute">{form.name.trim() || '우리 아이'}</p>
        {size && <span className="tag tag--pink">{SIZE_LABEL[size]}</span>}
      </div>

      <form className="stack" onSubmit={submit} noValidate>
        <Field label="이름" placeholder="예: 콩이" value={form.name} maxLength={12} onChange={(e) => set('name', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} error={show('name')} />
        <Field
          label="품종"
          placeholder="예: 말티즈"
          list="pp-breeds"
          value={form.breed}
          onChange={(e) => set('breed', e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, breed: true }))}
          error={show('breed')}
        />
        <datalist id="pp-breeds">
          {BREEDS.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <Field
          label="몸무게"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0.1"
          placeholder="예: 4.2"
          value={form.weight}
          onChange={(e) => set('weight', e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, weight: true }))}
          error={show('weight')}
          hint={!show('weight') && size ? `${SIZE_LABEL[size]}이에요. 동반 가능한 장소를 맞춤으로 알려드릴게요!` : ''}
          right={<span className="unit">kg</span>}
        />
        <div>
          <p className="field__label">성별</p>
          <Segmented name="성별" value={form.gender} onChange={(v) => set('gender', v)} options={[{ value: 'F', label: '♀ 여아' }, { value: 'M', label: '♂ 남아' }]} />
        </div>
        <div>
          <p className="field__label">중성화 여부</p>
          <Segmented name="중성화 여부" value={form.neutered} onChange={(v) => set('neutered', v)} options={[{ value: true, label: '했어요' }, { value: false, label: '안 했어요' }]} />
        </div>
        <Button type="submit" block loading={saving}>
          {isEdit ? '수정 완료' : '등록하기'}
        </Button>
        {isEdit && (
          <button type="button" className="btn btn--text center-self" onClick={() => setConfirmDel(true)}>
            이 프로필 삭제하기
          </button>
        )}
      </form>

      <ConfirmDialog open={confirmDel} danger title={`${form.name} 프로필을 삭제할까요?`} desc="삭제 후에는 되돌릴 수 없어요." confirmText="삭제" onConfirm={remove} onCancel={() => setConfirmDel(false)} />
    </div>
  );
}
