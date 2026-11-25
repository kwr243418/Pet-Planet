import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ASSISTANCE_DOG_NOTE, BUS_RULES, petBusAdvice } from '../../utils/transit.js';

/**
 * 반려동물과 버스 타기 — 등록한 반려동물 체중으로 안내 단계(가능 · 확인 필요 · 비추천)를 보여 주고 이용 수칙을 덧붙여요.
 * 근거와 검토 내용: docs/09_BUS_TRANSIT.md §반려동물 버스 이용 (운수회사 약관 · 기사 판단이 우선)
 */
export default function PetBusGuide() {
  const { pets, isLoggedIn } = useAuth();
  const list = pets?.length ? pets : [null];

  return (
    <section className="pet-bus" aria-label="반려동물과 버스 타기">
      <p className="eyebrow eyebrow--gold">반려동물과 버스 타기</p>
      <div className="pet-bus__advice">
        {list.map((pet) => {
          const a = petBusAdvice(pet?.weight);
          return (
            <div key={pet?.petId ?? 'none'} className={`pet-bus__card pet-bus__card--${a.level}`}>
              <p className="pet-bus__who">{pet ? `${pet.name} · ${pet.weight}kg` : '내 반려동물'}</p>
              <b className="pet-bus__title">{a.title}</b>
              <p className="pet-bus__desc">{a.desc}</p>
            </div>
          );
        })}
      </div>
      <ul className="pet-bus__rules">
        {BUS_RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
        <li className="pet-bus__assist">{ASSISTANCE_DOG_NOTE}</li>
      </ul>
      <p className="pet-bus__note">
        운수회사마다 이동장 크기 · 무게 기준이 다르고, 혼잡하거나 안전 문제가 있으면 기사님이 탑승을 거절할 수 있어요. 기준은 펫 플래닛의 참고 안내예요.
        {!isLoggedIn && (
          <>
            {' '}
            <Link to="/login" className="text-link">
              로그인
            </Link>
            하면 우리 아이 체중으로 안내해요.
          </>
        )}
      </p>
    </section>
  );
}
