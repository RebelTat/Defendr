const request = require('request-promise-native');
const moment = require('moment');
const { config } = require('./constants');
const Auth = require('./security/Auth');
const { from, interval, Subject } = require('rxjs');
const {
    switchMap,
    takeWhile,
    distinctUntilChanged,
    map,
    multicast,
    refCount,
} = require('rxjs/operators');

/**
 * Class which exposes several features on the Nest Camera API
 */
class Nest extends Auth {

    /**
     * Constructs a new Nest class. This creates an observable which can be polled
     * at a specified interval to retrieve the latest image from the Nest camera.
     * subscribers.
     * @param snapshotSubscriptionInterval Integer the amount of time between executions of the observable when a new
     * subscriber subscribes. Defaults to 5 seconds
     * @param eventSubscriptionInterval Integer The amount of time between executions of the event observable when
     * a new subscriber subscribes. Defaults to 3 seconds.
     */
    constructor(snapshotSubscriptionInterval = 5000, eventSubscriptionInterval = 3000) {
        super();
        const latestSnapshotSubject = new Subject();
        const eventSubject = new Subject();
        this._latestSnapshotObservable = interval(snapshotSubscriptionInterval).pipe(
            switchMap(() => from(this.getLatestSnapshot())),
            multicast(latestSnapshotSubject),
            refCount()
        );
        this._eventsObservable = interval(eventSubscriptionInterval).pipe(
            switchMap(() => from(this.getEvents())),
            takeWhile((events) => events.length >= 0),
            distinctUntilChanged((prevEvents, currEvents) => currEvents.length === lastEvents.length),
            map(events => events[events.length - 1]),
            multicast(eventSubject),
            refCount()
        );
    }

    async init() {
        this.refreshTokens();
        return this;
    }

    subscribeToLatestSnapshot(onSnapshot, onError = () => {}, onComplete = () => {}) {
        this._latestSnapshotObservable.subscribe({
            next(data) {
                onSnapshot(data)
            },
            error(e) {
                onError(e)
            },
            complete() {
                onComplete()
            }
        });
    }

    /**
     * Creates a multicasted subscription to the stream of camera events for both
     * motion and sound
     * @param onEvent Function called when a new event is received
     * @param onError Function called when an error occurs during the processing of an event
     * @param onComplete Function called when the subscriber no longer wishes to receive events.
     */
    subscribeToEvents(onEvent, onError = () => {}, onComplete = () => {}) {
        console.log('[INFO] Creating Subscription to Events');
        this._eventsObservable.subscribe({
            next(data) {
                onEvent(data);
            },
            error(e) {
                onError(e)
            },
            complete() {
              onComplete()
            }
        });
    }

    /**
     * Retrieves a list of recent events that the Nest camera detected. It can take two optional params
     * start and end which are unix timestamps in seconds since epoch and represent a window of time to retrieve
     * events for.
     * @param start integer Unix timestamp in seconds representing the starting period of time to retrieve events for
     * @param end integer Unix timestamp in seconds representing the ending period of time to retrieve events for
     * @returns {Promise<any>}
     */
    getEvents(start = null, end = null) {
        if(!this.jwtToken) {
            throw new Error("Access token is null or undefined call: #fetchAccessToken() to retrieve new OAuth token.");
        }

        const options = {
            'method': 'GET',
            'url': `${config.urls.NEXUS_HOST}${config.endpoints.EVENTS_ENDPOINT}`,
            'headers': {
                'Authorization': `Basic ${this.jwtToken}`
            }
        };
        try {
            return new Promise((res, rej) => {
                request(options)
                    .then(response => res(JSON.parse(response)))
                    .catch(err => rej(err));
            });
        } catch(e) {
            console.log('[ERROR] Failed to retrieve events from the Nest API Refreshing OAuth & JWT Tokens: ', e);
            this.refreshTokens();
        }
    };

    async getLatestSnapshot() {
        const options = {
            'method': 'GET',
            'url': `${config.urls.NEXUS_HOST}${config.endpoints.LATEST_IMAGE_ENDPOINT}`,
            'headers': {
                'Authorization': `Basic ${this.jwtToken}`
            }
        };
        try {
            return await request(options);
        } catch(e) {
            console.log('[ERROR] Failed to retrieve snapshots from the Nest API Refreshing OAuth & JWT Tokens: ', e);
            this.refreshTokens()
        }
    }

    /**
     * Retrieves a single snapshot image and writes it to disk
     * @param id String image id to retrieve. Will be postfixed with *-labs and prefixed with a unix time
     * stamp in seconds.
     * @returns {Promise<void>}
     */
    async getSnapshot(id) {
        if(!this.jwtToken) {
            throw new Error('JWT token is null or undefined. Call #fetchJwtToken() to retrieve new json web token.');
        }
        const options = {
            'method': 'GET',
            'url': `${config.urls.NEXUS_HOST}${config.endpoints.SNAPSHOT_ENDPOINT}${id}?crop_type=timeline&width=300`,
            'headers': {
                'Authorization': `Basic ${this.jwtToken}`
            }
        };
        try {
            request(options).pipe(fs.createWriteStream(path.join(__dirname, '..', 'assets', moment().format('YYYY-mm-dd_hh:mm:ss.SSS') + '.jpeg'))).on('close', () => {
                console.log('[INFO] Done writing image');
            });
        } catch(e) {
            console.log('[ERROR] Failed to retrieve snapshots from the Nest API: ', e)
        }
    };
}

module.exports = Nest;
