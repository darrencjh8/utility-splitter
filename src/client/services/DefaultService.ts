/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DefaultService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get tenant details
     * @returns any Successful response
     * @throws ApiError
     */
    public getTenant({
        tenantId,
    }: {
        /**
         * Tenant ID
         */
        tenantId: string,
    }): CancelablePromise<{
        id?: string;
        name?: string;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tenant',
            query: {
                'tenantId': tenantId,
            },
        });
    }
    /**
     * Update tenant details
     * @returns any Successful response
     * @throws ApiError
     */
    public putTenant({
        tenantId,
        requestBody,
    }: {
        /**
         * Tenant ID
         */
        tenantId: string,
        requestBody: {
            name?: string;
        },
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/tenant',
            query: {
                'tenantId': tenantId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get tenant data
     * @returns any Successful response
     * @throws ApiError
     */
    public getTenantData({
        tenantId,
        year,
    }: {
        /**
         * Tenant ID
         */
        tenantId: string,
        /**
         * Optional year filter
         */
        year?: number,
    }): CancelablePromise<Record<string, any>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tenant/data',
            query: {
                'tenantId': tenantId,
                'year': year,
            },
        });
    }
    /**
     * Update tenant data
     * @returns any Successful response
     * @throws ApiError
     */
    public putTenantData({
        tenantId,
        requestBody,
        year,
    }: {
        /**
         * Tenant ID
         */
        tenantId: string,
        requestBody: Record<string, any>,
        /**
         * Optional year filter
         */
        year?: number,
    }): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/tenant/data',
            query: {
                'tenantId': tenantId,
                'year': year,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
