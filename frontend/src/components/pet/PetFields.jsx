import { useRef, useState } from 'react';
import { Field, OptionGroup } from '../common/ui.jsx';
import { TinyDog } from '../illust/index.jsx';
import { validateBreed, validatePetName, validateWeight } from '../../utils/validators.js';

export const EMPTY_PET = { name: '', breed: '', weight: '', gender: null, neutered: null, photoUrl: null };

const BREEDS = ['말티즈', '푸들', '포메라니안', '비숑 프리제', '시츄', '치와와', '웰시코기', '진돗개', '시바견', '골든 리트리버', '래브라도 리트리버', '보더콜리', '닥스훈트', '프렌치 불독', '믹스'];

/** 반려동물 필수값 검증: 이름·품종·체중·성별·중성화 */
export function validatePet(p) {
  const e = {};
  const n = validatePetName(p.name);
  const b = validateBreed(p.breed);
  const w = validateWeight(p.weight);
  if (n) e.name = n;
  if (b) e.breed = b;
  if (w) e.weight = w;
  if (!p.gender) e.gender = '성별을 선택해 주세요.';
  if (typeof p.neutered !== 'boolean') e.neutered = '중성화 여부를 선택해 주세요.';
  return e;
}

export const toPetPayload = (p) => ({ ...p, name: p.name.trim(), breed: p.breed.trim(), weight: Number(p.weight) });

/** 사진을 240px 정사각 썸네일(JPEG)로 줄여 data URL 로 */
function resizeImage(file, size = 240) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** 반려동물 입력 묶음: 사진 · 이름 · 품종 · 체중 · 성별 · 중성화 */
export default function PetFields({ value, onChange, errors = {}, idPrefix = 'pet', onFocus }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  const fileRef = useRef(null);
  const [photoError, setPhotoError] = useState('');

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setPhotoError('이미지 파일만 올릴 수 있어요.');
    if (file.size > 10 * 1024 * 1024) return setPhotoError('10MB 이하 사진을 골라 주세요.');
    try {
      setPhotoError('');
      set('photoUrl')(await resizeImage(file));
    } catch {
      setPhotoError('사진을 불러오지 못했어요.');
    }
  };

  return (
    <div className="pet-fields" onFocus={onFocus}>
      <div className="pet-fields__photo">
        <button type="button" className="pet-photo" onClick={() => fileRef.current?.click()} aria-label="반려동물 사진 선택">
          {value.photoUrl ? <img src={value.photoUrl} alt="" /> : <TinyDog size={60} />}
          <span className="pet-photo__btn">{value.photoUrl ? '변경' : '사진'}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        {value.photoUrl && (
          <button type="button" className="btn btn--text" onClick={() => set('photoUrl')(null)}>
            사진 삭제
          </button>
        )}
        {photoError && <p className="field__error">{photoError}</p>}
      </div>
      <div className="pet-fields__grid">
        <Field id={`${idPrefix}-name`} label="이름" placeholder="예: 보리" maxLength={12} value={value.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} />
        <Field id={`${idPrefix}-breed`} label="품종" placeholder="예: 진돗개" list="pp-breeds" value={value.breed} onChange={(e) => set('breed')(e.target.value)} error={errors.breed} />
        <Field
          id={`${idPrefix}-weight`}
          label="체중 (kg)"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0.1"
          placeholder="예: 18"
          className="field--weight"
          value={value.weight}
          onChange={(e) => set('weight')(e.target.value)}
          error={errors.weight}
        />
      </div>
      <datalist id="pp-breeds">
        {BREEDS.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <p className="note-box">체중은 펫 호텔 객실의 최대 수용 몸무게와 자동으로 비교돼요.</p>
      <div className="pet-fields__toggles">
        <div>
          <p className="field__label">성별</p>
          <OptionGroup className="opts--block" label="성별" value={value.gender} onChange={set('gender')} options={[{ value: 'MALE', label: '수컷' }, { value: 'FEMALE', label: '암컷' }]} />
          {errors.gender && <p className="field__error">{errors.gender}</p>}
        </div>
        <div>
          <p className="field__label">중성화</p>
          <OptionGroup className="opts--block" label="중성화" value={value.neutered} onChange={set('neutered')} options={[{ value: true, label: '완료' }, { value: false, label: '안 함' }]} />
          {errors.neutered && <p className="field__error">{errors.neutered}</p>}
        </div>
      </div>
    </div>
  );
}
