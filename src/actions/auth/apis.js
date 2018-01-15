import axios from 'axios'
import moment from 'moment'

import * as actions from './actions'
import { selectPattern, recentEmpty, redHeartEmpty, trashEmpty } from '../fm/actions'
import { playlistGET, recentListGET, redHeartListGET, trashListGET, userInfoGET, appChannelGet } from '../fm/apis'
import { settingLoad } from '../setting/apis'
import oToFd from '../../helper/objToFormD'
import db from '../../helper/db'
import { rendererProcessSend } from '../../helper/electron'

const AUTH_URL = 'https://www.douban.com/service/auth2/token?udid=cf9aed3a0bc54032661c6f84d220b1f28d3722ec' // Auth Url

// Fixed params for logining
const authFixedParams = {
  client_id: '02f7751a55066bcb08e65f4eff134361',
  client_secret: '63cf04ebd7b0ff3b',
  grant_type: 'password',
  redirect_uri: 'http://douban.fm',
}

/**
 * Deal with logining request, need username and password, POST method
 * usernameAndPassword => {
 *   'username': '',
 *   'password': '' 
 * }
 * 
 * The callback function will execute after db store userToken
 * for example, handle redirect
 * 
 * @param {Object} usernameAndPassword - username and password
 * @param {Function} callback - callback function defined
 * @returns {Function} - a thunk func which return Axios login request
 */
export const authPost = (usernameAndPassword, callback) => {
  return dispatch => {
    dispatch(actions.authLoginRequest())
    return axios({
      method: 'POST',
      url: AUTH_URL,
      data: oToFd(Object.assign(authFixedParams, usernameAndPassword)),
    })
      .then(response => {
        const data = response.data
        const userToken = {
          access_token: data.access_token,
          douban_user_name: data.douban_user_name
        }
        dispatch(actions.authLoginResponse(userToken))
        dispatch(userInfoGET())
        dispatch(appChannelGet())
        dispatch(recentListGET())
        dispatch(redHeartListGET())
        dispatch(trashListGET())
        rendererProcessSend('touchBarResetPause')
        dispatch(playlistGET('new'))
        db.insert({
          _id: 1,
          userToken,
          time: moment()
            .valueOf()
        }, (err, doc) => {
          console.log(doc)
        })
        if (typeof callback === 'function') {
          callback()
        }
      })
      .catch(() => {
        dispatch(actions.authLoginFail('请检查账号或密码是否正确'))
      })
  }
}

/**
 * Deal with loading user info from db file
 * 
 * @returns {Function} - a thunk function
 */
export const authLoad = () => {
  return dispatch => {
    dispatch(settingLoad())
    dispatch(appChannelGet())
    dispatch(playlistGET('new'))
    db.findOne({
      _id: 1
    }, (err, doc) => {
      if (doc !== null) {
        let now = moment()
          .valueOf()
        let fromNow = moment(now)
          .diff(doc.time, 'days')

        // remove user info when already logined 60 days
        console.log('token storage time ' + fromNow + ' day(s)')
        if (fromNow === 60) {
          db.remove({
            _id: 1
          })
        } else {
          dispatch(actions.authTokenLoad(doc))
          dispatch(userInfoGET())
          dispatch(recentListGET())
          dispatch(redHeartListGET())
          dispatch(trashListGET())
        }
      }
    })
    rendererProcessSend('resizeWindowAfterLoading')
    rendererProcessSend('touchBarResetPause')
    rendererProcessSend('patternSwitch', 'select')
  }
}

/**
 * Deal with Loging out
 * 
 * @param {any} dispatch - dispatch function
 * @param {any} callback - callback function defined
 */
export const authRemove = (dispatch, callback) => {
  db.remove({
    _id: 1
  }, (err, numRemoved) => {
    console.log('token remove: num(' + numRemoved + ')')
    if (typeof callback === 'function') {
      callback()
    }
    dispatch(actions.authLogout())
    dispatch(selectPattern)
    rendererProcessSend('touchBarResetPause')
    rendererProcessSend('patternSwitch', 'select')
    dispatch(playlistGET('new'))
    dispatch(recentEmpty())
    dispatch(redHeartEmpty())
    dispatch(trashEmpty())
  })
}
