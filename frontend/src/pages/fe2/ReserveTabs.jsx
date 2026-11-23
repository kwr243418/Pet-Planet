import { useLocation, useNavigate } from 'react-router-dom';
import { OptionGroup } from '../../components/common/ui.jsx';

/** [동물병원 진료] / [펫 호텔] 예약 종류 탭 */
export default function ReserveTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <OptionGroup
      size="lg"
      label="예약 종류"
      value={pathname.startsWith('/reservations/hotel') ? 'hotel' : 'hospital'}
      onChange={(v) => navigate(`/reservations/${v}`)}
      options={[
        { value: 'hospital', label: '동물병원 진료' },
        { value: 'hotel', label: '펫 호텔' },
      ]}
    />
  );
}