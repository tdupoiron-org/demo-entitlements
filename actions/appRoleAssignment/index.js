const axios = require('axios');
const core = require('@actions/core');

const SCOPE = 'https://graph.microsoft.com/.default';
const AUTHORITY_HOST_URL = 'https://login.microsoftonline.com';
const GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';

// Read inputs from workflow file
const CLIENT_ID = core.getInput('CLIENT_ID');
const CLIENT_SECRET = core.getInput('CLIENT_SECRET');
const TENANT_ID = core.getInput('TENANT_ID');

const GITHUB_APP_NAME = core.getInput('GITHUB_APP_NAME');
const GITHUB_RESOURCE_TYPE = core.getInput('GITHUB_RESOURCE_TYPE');
const GITHUB_RESOURCE_NAME = core.getInput('GITHUB_RESOURCE_NAME');
const GITHUB_ROLE_NAME = core.getInput('GITHUB_ROLE_NAME');

// Function to get access token
async function getAccessToken() {

    const data = `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&scope=${SCOPE}`;
    const config = {
        headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    return axios.post(`${AUTHORITY_HOST_URL}/${TENANT_ID}/oauth2/v2.0/token`, data, config).then((response) => {
        return response.data.access_token;
    }).catch((error) => {
        core.setFailed(error);
    });
};

async function invokeGraphGet(token, url) {

    const config = {
        headers: {
        'Authorization': `Bearer ${token}`
        }
    };

    core.info(`Invoking GET ${url}`);

    return axios.get(url, config).then((response) => {
        return response.data;
    }).catch((error) => {
        core.setFailed(error);
        throw error;
    });

}

async function getApplicationFromName(token, appName) {
    var application = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/servicePrincipals?$filter=displayName eq '${appName}'`)
    return application;
}

async function getUserFromName(token, userName) {
    var user = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/users?$filter=userPrincipalName eq '${userName}'`)
    return user;
}

async function getGroupFromName(token, groupName) {
    var group = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/groups?$filter=displayName eq '${groupName}'`)
    return group;
}

async function assignRole(token, appId, roleId, principalId) {

    const data = `{"principalId": "${principalId}","resourceId": "${appId}","appRoleId": "${roleId}"}`;
    const config = {
        headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
        }
    };

    core.info(`Invoking POST ${GRAPH_ENDPOINT}/servicePrincipals/${appId}/appRoleAssignments`);

    return axios.post(`${GRAPH_ENDPOINT}/servicePrincipals/${appId}/appRoleAssignments`, data, config).then((response) => {
        return response.data;
    }).catch((error) => {
        core.setFailed(error);
        throw error;
    });

}


async function main() {

    core.info(`Assigning role ${GITHUB_ROLE_NAME} to ${GITHUB_RESOURCE_TYPE} ${GITHUB_RESOURCE_NAME} for app ${GITHUB_APP_NAME}`)

    var token = await getAccessToken();
    core.debug(`token: ${token}`);

    var app = await getApplicationFromName(token, GITHUB_APP_NAME);
    
    if (GITHUB_RESOURCE_TYPE == 'group') {
        var group = await getGroupFromName(token, GITHUB_RESOURCE_NAME);
    } else {
        var user = await getUserFromName(token, GITHUB_RESOURCE_NAME);
    }

    var appId = app.value[0].id;
    var roleId = app.value[0].appRoles.filter(role => role.displayName == GITHUB_ROLE_NAME)[0].id;
    var principalId = GITHUB_RESOURCE_TYPE == 'group' ? group.value[0].id : user.value[0].id;

    if (appId == null || roleId == null || principalId == null) {
        core.setFailed('Could not find app, role or principal');
        core.debug(`appId: ${appId}`);
        core.debug(`roleId: ${roleId}`);
        core.debug(`principalId: ${principalId}`);
        return;
    }
    var result = await assignRole(token, appId, roleId, principalId);

    core.info(`Role assigned successfully`)
    core.debug("result: " + JSON.stringify(result));

}

main();