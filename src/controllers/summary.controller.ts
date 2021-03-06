/**
 * Author       : 유경수
 * Created Date : 2020-11-09
 * Description  : 요약 글 관련 API
 * History
 * -
 */
import { Request, Response } from "express";
import * as Models from "../utils/db/models";
import { ENV, VALIDATOR } from "../utils";
import { IAPIError } from "../interfaces";
import * as moment from "moment";

const env = ENV();

/**
 * @description 요약 글 상세 조회하기
 * @param summary_id 글 번호
 */
export const fetchDetail = async (req: Request, res: Response) => {
    try {
        // 글 번호 가져오기
        const { summary_id } = req.params;

        // 사용자 아이피 가져오기
        const forwarded = req.headers["x-forwarded-for"];
        const ip = forwarded
            ? forwarded.toString().split(/, /)[0]
            : req.connection.remoteAddress;

        const result = await Models.Summary.findOne({
            _id: summary_id,
        });

        // 같은 ip는 조회수 카운트에 더하지 않음
        const isExists = result.views.find((item) => {
            return item.ip === ip;
        });

        if (!isExists) {
            result.views.push({
                ip: ip,
                user: req.user || undefined,
                viewDate: new Date(),
            });
            await result.save();
        }

        res.json(result);
    } catch (e) {
        const _error: IAPIError = {
            displayMessage: "조회 중 오류가 발생했습니다",
            message: e.message,
            error: e,
        };
        res.status(500).json(_error);
    }
};

/**
 * @description 요약 글 목록 조회하기
 * @query page 글 페이지
 * @query cnt 글 조회 갯수
 */
export const fetchAll = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const cnt = Number(req.query.cnt) || 15;
        const result = await Models.Summary.aggregate([
            {
                $sort: { createdAt: -1 },
            },
            {
                $skip: cnt * (page - 1),
            },
            {
                $limit: cnt,
            },
        ]);

        res.status(200).json(result);
    } catch (e) {
        const _error: IAPIError = {
            displayMessage: "조회 중 오류가 발생했습니다",
            message: e.message,
            error: e,
        };
        res.status(500).json(_error);
    }
};

/**
 * @description 요약 글 추가하기
 */
export const create = async (req: Request, res: Response) => {
    try {
        // 데이터가 올바른지 확인
        let {
            articleTitle,
            articleLink,
            articleOriginalLink,
            content,
            timestampStartDt,
            timestampFinishDt,
        } = req.body;

        // 1. 제목 확인
        if (
            VALIDATOR.isEmpty(articleTitle) ||
            articleTitle.length < 10 ||
            articleTitle.length > 100
        ) {
            throw new Error("제목 형식이 올바르지 않습니다");
        }

        // 2. 링크 확인
        if (
            VALIDATOR.isEmpty(articleLink) ||
            articleLink.length > 1000 ||
            !VALIDATOR.isUrl(articleLink)
        ) {
            throw new Error("링크 형식이 올바르지 않습니다");
        }
        if (
            VALIDATOR.isEmpty(articleOriginalLink) ||
            articleOriginalLink.length > 1000 ||
            !VALIDATOR.isUrl(articleOriginalLink)
        ) {
            throw new Error("링크 형식이 올바르지 않습니다");
        }

        // 3. 내용 확인
        if (VALIDATOR.isEmpty(content) || content.length > 3000) {
            throw new Error("내용이 올바르지 않습니다");
        }

        // 4. 타임스탬프 관련
        if (
            !moment(timestampStartDt).isValid() ||
            !moment(timestampFinishDt).isValid()
        ) {
            throw new Error("타이머의 시간정보가 올바르지 않습니다");
        }

        // 데이터 생성
        const newSummary = new Models.Summary({
            article: {
                title: articleTitle,
                link: articleLink,
                originalLink: articleOriginalLink,
            },
            user: req.user,
            content: content,
            timestamp: {
                start: moment(timestampStartDt).toDate(),
                finish: moment(timestampFinishDt).toDate(),
            },
        });

        newSummary.save();
        res.status(201).json({
            message: "생성되었습니다",
        });
    } catch (e) {
        const _error: IAPIError = {
            displayMessage: "조회 중 오류가 발생했습니다",
            message: e.message,
            error: e,
        };
        res.status(500).json(_error);
    }
};

/**
 * @description 요약 글 수정하기
 * @param summary_id 수정할 글 번호
 * @query content 수정할 내용
 */
export const update = async (req: Request, res: Response) => {
    try {
        const { summary_id } = req.params;
        const { content } = req.body;
        const fetchedSummary = await Models.Summary.findOne({
            _id: summary_id,
        });
        if (fetchedSummary) {
            if (!VALIDATOR.isEmpty(content) && content.length < 3000) {
                fetchedSummary.content = content;
                fetchedSummary.lastUpdatedDate = new Date();
                await fetchedSummary.save();

                res.json({
                    message: "수정되었습니다",
                });
            } else {
                throw new Error("글 내용이 올바르지 않습니다");
            }
        } else {
            throw new Error("존재하지 않는 글입니다");
        }
    } catch (e) {
        const _error: IAPIError = {
            displayMessage: "실행 중 오류가 발생했습니다",
            message: e.message,
            error: e,
        };
        res.status(500).json(_error);
    }
};

/**
 * @description 요약 글 삭제하기
 * @param summary_id 삭제할 글 번호
 */
export const remove = async (req: Request, res: Response) => {
    try {
        const { summary_id } = req.params;
        const fetchedSummary = await Models.Summary.findOne({
            _id: summary_id,
        });
        if (fetchedSummary !== null && fetchedSummary !== undefined) {
            if (fetchedSummary.user._id === req.user._id || req.user.isAdmin) {
                const result = await Models.Summary.updateOne(
                    {
                        _id: summary_id,
                    },
                    {
                        isDeleted: true,
                    }
                );

                res.json({
                    message: "삭제되었습니다",
                    result: result,
                });
            } else {
                throw new Error("삭제 권한이 없는 사용자 입니다");
            }
        } else {
            throw new Error("존재하지 않는 글 입니다");
        }
    } catch (e) {
        const _error: IAPIError = {
            displayMessage: "실행 중 오류가 발생했습니다",
            message: e.message,
            error: e,
        };
        res.status(500).json(_error);
    }
};

// 요약 글 점수 주기
