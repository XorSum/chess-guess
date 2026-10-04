import type { Puzzle } from '../../core/types';
import generated from './generated/opening-puzzles.json';

// 静态保底题库：开局树加载失败时的回退。由 14 万局棋谱统计生成
// （开局前 20 ply 的局面走法胜率，行棋方视角），与开局树同源。
export const PUZZLES: Puzzle[] = generated as Puzzle[];
