/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as externs from '@firebase/auth-types-exp';
import { querystring } from '@firebase/util';

import {
  signInWithIdp,
  SignInWithIdpRequest
} from '../../api/authentication/idp';
import { Auth } from '../../model/auth';
import { IdTokenResponse } from '../../model/id_token';
import { AuthErrorCode } from '../errors';
import { fail } from '../util/assert';
import { AuthCredential } from './';

const IDP_REQUEST_URI = 'http://localhost';

export interface OAuthCredentialParams {
  idToken?: string | null;
  accessToken?: string | null;
  oauthToken?: string;
  secret?: string;
  oauthTokenSecret?: string;
  nonce?: string;
  pendingToken?: string;
  providerId: externs.ProviderId;
  signInMethod: externs.SignInMethod;
}

export class OAuthCredential
  implements externs.OAuthCredential, AuthCredential {
  idToken?: string;
  accessToken?: string;
  secret?: string;
  nonce?: string;
  private pendingToken: string | null = null;

  private constructor(
    readonly providerId: externs.ProviderId,
    readonly signInMethod: externs.SignInMethod
  ) {}

  static _fromParams(params: OAuthCredentialParams): OAuthCredential {
    const cred = new OAuthCredential(params.providerId, params.signInMethod);

    if (params.idToken || params.accessToken) {
      // OAuth 2 and either ID token or access token.
      if (params.idToken) {
        cred.idToken = params.idToken;
      }

      if (params.accessToken) {
        cred.accessToken = params.accessToken;
      }

      // Add nonce if available and no pendingToken is present.
      if (params.nonce && !params.pendingToken) {
        cred.nonce = params.nonce;
      }

      if (params.pendingToken) {
        cred.pendingToken = params.pendingToken;
      }
    } else if (params.oauthToken && params.oauthTokenSecret) {
      // OAuth 1 and OAuth token with token secret
      cred.accessToken = params.oauthToken;
      cred.secret = params.oauthTokenSecret;
    } else {
      fail('todo', AuthErrorCode.ARGUMENT_ERROR);
    }

    return cred;
  }

  toJSON(): object {
    return {
      idToken: this.idToken,
      accessToken: this.accessToken,
      secret: this.secret,
      nonce: this.nonce,
      pendingToken: this.pendingToken,
      providerId: this.providerId,
      signInMethod: this.signInMethod
    };
  }

  static fromJSON(obj: object): externs.OAuthCredential | null {
    const { providerId, signInMethod, ...rest }: Partial<OAuthCredential> = obj;
    if (!providerId || !signInMethod) {
      return null;
    }

    const cred = new OAuthCredential(providerId, signInMethod);
    Object.assign(cred, rest);
    return cred;
  }

  _getIdTokenResponse(auth: Auth): Promise<IdTokenResponse> {
    const request = this.makeRequest();
    return signInWithIdp(auth, request);
  }

  _linkToIdToken(auth: Auth, idToken: string): Promise<IdTokenResponse> {
    const request = this.makeRequest();
    request.idToken = idToken;
    return signInWithIdp(auth, request);
  }

  _getReauthenticationResolver(auth: Auth): Promise<IdTokenResponse> {
    const request = this.makeRequest();
    request.autoCreate = false;
    return signInWithIdp(auth, request);
  }

  private makeRequest(): SignInWithIdpRequest {
    const request: SignInWithIdpRequest = {
      requestUri: IDP_REQUEST_URI,
      returnSecureToken: true,
      postBody: null
    };

    const postBody: { [key: string]: string } = {};
    if (this.idToken) {
      postBody['id_token'] = this.idToken;
    }
    if (this.accessToken) {
      postBody['access_token'] = this.accessToken;
    }
    if (this.secret) {
      postBody['oauth_token_secret'] = this.secret;
    }

    postBody['providerId'] = this.providerId;
    if (this.nonce && !this.pendingToken) {
      postBody['nonce'] = this.nonce;
    }

    if (this.pendingToken) {
      request.pendingToken = this.pendingToken;
    } else {
      request.postBody = querystring(postBody);
    }

    return request;
  }
}
