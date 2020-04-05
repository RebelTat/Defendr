const fs = require('fs');
const path = require('path');
const request = require('request-promise-native');
const moment = require('moment');
const { config } = require('../constants');
const { API_KEY, CLIENT_ID, REFRESH_TOKEN } = process.env;

/**
 * Auth.js
 * Manages application security and authentication when interacting with the Nest API.
 * This class has methods to fetch and retrieve an access token and JWT token
 */
class Auth {

    constructor() {
        this._accessToken = null;
        this._jwtToken = null;
    }

    get accessToken() {
        return this._accessToken;
    }
    get jwtToken() {
        return this._jwtToken;
    }

    /**
     * Retrieves a Google OAuth token used to call Nest/Nexus API's and services.
     * @returns {Promise<any>}
     */
    async fetchOAuthToken() {
        if(this._accessToken) return this._accessToken;
        const options = {
            'method': 'POST',
            'url': config.urls.OAUTH_URL,
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Host': 'oauth2.googleapis.com'
            },
            form: {
                'refresh_token': REFRESH_TOKEN,
                'client_id': CLIENT_ID,
                'grant_type': 'refresh_token'
            }
        };
        try {
            const { access_token } = JSON.parse(await request(options));
            this._accessToken = access_token;
            return access_token;
        } catch(e) {
            console.log('[ERROR] Failed to retrieve OAuth token from Nest API: ', e);
        }
    };


    /**
     * Retrieves a JWT authorization token used to call other Nest/Nexus API's
     * @param accessToken String OAuth access token from #getOAuthToken function
     * @returns {Promise<any>}
     */
    async fetchJwtToken(accessToken) {
        if(this._jwtToken) return this._jwtToken;
        const options = {
            'method': 'POST',
            'url': config.urls.JWT_TOKEN_URL,
            'headers': {
                'x-goog-api-key': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Host': 'nestauthproxyservice-pa.googleapis.com',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({"expire_after":"3600s","policy_id":"authproxy-oauth-policy","google_oauth_access_token":accessToken,"embed_google_oauth_access_token":"true"})
        };
        try {
            const { jwt } = JSON.parse(await request(options));
            this._jwtToken = jwt;
            return jwt;
        } catch(e) {
            console.log('[ERROR] Failed to retrieve JWT token from Nest API: ', e);
        }
    };
}

module.exports = Auth;