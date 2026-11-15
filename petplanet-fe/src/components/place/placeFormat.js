import { walkingMinutes } from '../../utils/geo.js';

export { formatDistance, formatRating, INDOOR_LABEL, SIZE_LABEL } from '../../utils/format.js';

export const walkingMinutesLabel = (km) => `${walkingMinutes(km)}분`;
