/**الناف واللوحة والمحفظة رح يستخدموا نفس المصدر: */
import { learnerDemo } from "../data/learnerDemo";
import { approvedCourseAwards } from "../data/pointsPolicy";
import { getWalletSnapshot } from "../data/walletHelpers";

export function useLearnerWallet() {
  return getWalletSnapshot(
    learnerDemo.points,
    approvedCourseAwards,
  );
}