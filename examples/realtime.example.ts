import { IgApiClientRealtime, withRealtime } from '../src';
import { GraphQLSubscriptions } from '../src/realtime/subscriptions';
import { IgApiClient } from 'instagram-private-api';
import { SkywalkerSubscriptions } from '../src/realtime/subscriptions';

const {IG_USERNAME = '', IG_PASSWORD = ''} = process.env;

(async () => {
    // this extends the IgApiClient with realtime features
    const ig: IgApiClientRealtime = withRealtime(new IgApiClient());
    // normal login
    ig.state.generateDevice(IG_USERNAME);
    await ig.account.login(IG_USERNAME, IG_PASSWORD);
    // now `ig` is a client with a valid session

    // an example on how to subscribe to live comments
    const subToLiveComments = (broadcastId: string) =>
        // you can add other GraphQL subs using .subscribe
        ig.realtime.graphQlSubscribe(GraphQLSubscriptions.getLiveRealtimeCommentsSubscription(broadcastId));

    // whenever something gets sent and has no event, this is called
    ig.realtime.on('receive', (topic, messages) => {
        console.log('receive', topic, messages);
    });
    ig.realtime.on('direct', logEvent('direct'));
    // this is called with a wrapper use {message} to only get the message from the wrapper
    ig.realtime.on('message', logEvent('messageWrapper'));
    // whenever something gets sent to /ig_realtime_sub and has no event, this is called
    ig.realtime.on('realtimeSub', logEvent('realtimeSub'));
    // whenever the client has a fatal error
    ig.realtime.on('error', console.error);
    ig.realtime.on('close', () => console.error('RealtimeClient closed'));
    // connect
    // this will resolve once all initial subscriptions have been sent
    await ig.realtime.connect({
        // optional
        graphQlSubs: [
            // these are some subscriptions
            GraphQLSubscriptions.getAppPresenceSubscription(),
            GraphQLSubscriptions.getClientConfigUpdateSubscription(),
            GraphQLSubscriptions.getZeroProvisionSubscription(ig.state.phoneId),
            GraphQLSubscriptions.getDirectStatusSubscription(),
            GraphQLSubscriptions.getDirectTypingSubscription(ig.state.cookieUserId),
            GraphQLSubscriptions.getAsyncAdSubscription(ig.state.cookieUserId),
        ],
        // optional
        skywalkerSubs: [
            SkywalkerSubscriptions.directSub(ig.state.cookieUserId),
            SkywalkerSubscriptions.liveSub(ig.state.cookieUserId)
        ],
        // optional
        // this enables you to get direct messages
        irisData: await ig.feed.directInbox().request(),
        // optional
        // in here you can change connect options
        // available are all properties defined in MQTToTConnectionClientInfo
        connectOverrides: {
        },
    });

    // simulate turning the device off after 2s and turning it back on after another 2s
    setTimeout(() => {
        console.log('Device off');
        // from now on, you won't receive any realtime-data as you "aren't in the app"
        // the keepAliveTimeout is somehow a 'constant' by instagram
        ig.realtime.direct.sendForegroundState({inForegroundApp: false, inForegroundDevice: false, keepAliveTimeout: 900});
    }, 2000);
    setTimeout(() => {
        console.log('In App');
        ig.realtime.direct.sendForegroundState({inForegroundApp: true, inForegroundDevice: true, keepAliveTimeout: 60});
    }, 4000);
})();

/**
 * A wrapper function to log to the console
 * @param name
 * @returns {(data) => void}
 */
function logEvent(name: string) {
    return (data: any) => console.log(name, data);
}
